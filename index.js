const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');

function normalizeUrl(input) {
    // Check if it's a local file path
    if (input.endsWith('.xml') && !input.startsWith('http')) {
        return input;
    }
    
    // Add https:// if no protocol is specified
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
        return `https://${input}`;
    }
    
    return input;
}

async function readLocalSitemap(filepath) {
    try {
        const data = await fs.readFile(filepath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(data);
        return result.urlset.url.map(entry => entry.loc[0]);
    } catch (error) {
        console.error(`Error reading local sitemap ${filepath}:`, error.message);
        return [];
    }
}

async function fetchSitemap(sitemapUrl) {
    try {
        // Check if it's a local file
        if (sitemapUrl.endsWith('.xml') && !sitemapUrl.startsWith('http')) {
            return await readLocalSitemap(sitemapUrl);
        }

        const response = await axios.get(sitemapUrl);
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        return result.urlset.url.map(entry => entry.loc[0]);
    } catch (error) {
        console.error(`Error fetching sitemap from ${sitemapUrl}:`, error.message);
        return [];
    }
}

async function fetchPageMetadata(pageUrl) {
    try {
        console.log(`📄 Parsing page: ${pageUrl}`);
        const response = await axios.get(pageUrl);
        const $ = cheerio.load(response.data);
        
        const metadata = {
            title: $('title').text() || $('h1').first().text() || path.basename(pageUrl),
            description: $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content') || 
                        'No description available',
            url: pageUrl
        };
        
        console.log(`✅ Successfully parsed: ${metadata.title}`);
        return metadata;
    } catch (error) {
        console.error(`❌ Error parsing ${pageUrl}:`, error.message);
        return null;
    }
}

function groupUrlsBySection(urls) {
    const sections = new Map();
    const directoryPages = new Map();
    
    // First pass: analyze URLs to find directories with subpages
    for (const pageUrl of urls) {
        const parsedUrl = new URL(pageUrl);
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        
        if (pathSegments.length === 0) {
            // Handle root URLs
            if (!sections.has('website')) {
                sections.set('website', []);
            }
            sections.get('website').push(pageUrl);
        } else {
            const firstSegment = pathSegments[0];
            if (!directoryPages.has(firstSegment)) {
                directoryPages.set(firstSegment, new Set());
            }
            // Add the URL path to the set for this directory
            directoryPages.get(firstSegment).add(pathSegments.join('/'));
        }
    }
    
    // Second pass: create sections only for directories with subpages
    for (const pageUrl of urls) {
        const parsedUrl = new URL(pageUrl);
        const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
        
        if (pathSegments.length > 0) {
            const firstSegment = pathSegments[0];
            const pagesInDirectory = directoryPages.get(firstSegment);
            
            // Only create a section if this directory has multiple pages
            if (pagesInDirectory && pagesInDirectory.size > 1) {
                if (!sections.has(firstSegment)) {
                    sections.set(firstSegment, []);
                }
                sections.get(firstSegment).push(pageUrl);
            } else {
                // If directory has only one page, add it to the website section
                if (!sections.has('website')) {
                    sections.set('website', []);
                }
                sections.get('website').push(pageUrl);
            }
        }
    }
    
    return sections;
}

function formatSectionTitle(section) {
    // Special case for website section
    if (section === 'website') {
        return 'Website';
    }
    
    return section
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

async function generateLLMsTxt(inputs) {
    let content = [];
    
    for (const input of inputs) {
        try {
            const normalizedInput = normalizeUrl(input);
            let urls;
            let websiteUrl;

            if (normalizedInput.endsWith('.xml')) {
                // If it's a sitemap file, use its URLs and extract website URL from the first URL
                urls = await fetchSitemap(normalizedInput);
                if (urls.length > 0) {
                    websiteUrl = new URL(urls[0]).origin;
                } else {
                    console.error(`No URLs found in sitemap: ${normalizedInput}`);
                    continue;
                }
            } else {
                // If it's a website URL, try to fetch its sitemap
                websiteUrl = normalizedInput;
                const sitemapUrl = new URL('/sitemap.xml', websiteUrl).toString();
                urls = await fetchSitemap(sitemapUrl);
            }

            // Get website name and description
            const websiteMetadata = await fetchPageMetadata(websiteUrl);
            content.push(`# ${websiteMetadata.title}\n`);
            content.push(`> ${websiteMetadata.description}\n`);
            
            // Process each section
            const sections = groupUrlsBySection(urls);
            for (const [section, sectionUrls] of sections) {
                content.push(`## ${formatSectionTitle(section)}`);
                
                // Fetch metadata for each URL in the section
                const entries = await Promise.all(
                    sectionUrls.map(url => fetchPageMetadata(url))
                );
                
                // Add valid entries to the content
                entries
                    .filter(entry => entry !== null)
                    .forEach(entry => {
                        content.push(`- [${entry.title}](${entry.url}) - ${entry.description}`);
                    });
                
                content.push(''); // Add empty line between sections
            }
        } catch (error) {
            console.error(`Error processing ${input}:`, error.message);
        }
    }
    
    return content.join('\n');
}

async function main() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'inputs',
            message: 'Enter website URLs or sitemap.xml file paths (separated by commas):',
            validate: input => input.trim().length > 0
        }
    ]);
    
    const inputs = answers.inputs.split(',').map(input => input.trim());
    const content = await generateLLMsTxt(inputs);
    
    await fs.writeFile('llms.txt', content, 'utf8');
    console.log('llms.txt has been generated successfully!');
}

main().catch(error => {
    console.error('An error occurred:', error);
    process.exit(1);
}); 