# LLMs.txt Generator

A Node.js tool that generates LLMs.txt files from website URLs by parsing their sitemaps and extracting metadata.

## Features

- Accepts multiple inputs:
  - Website URLs (automatically adds https:// if not present)
  - Local sitemap.xml file paths
  - Multiple domains (with custom section grouping)
- Automatically fetches and parses sitemap.xml files
- Extracts page titles and meta descriptions
- Intelligent content organization:
  - Groups root pages (/) under a "Website" section
  - Creates sections only for directories with multiple pages
  - Groups multiple domains under user-specified sections
- Real-time progress tracking with page parsing status
- Generates a structured LLMs.txt file

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

## Usage

1. Run the script:
```bash
npm start
```

2. When prompted:
   - Enter website URLs or sitemap.xml file paths (separated by commas)

3. The script will generate a `LLMs.txt` file in the current directory with the following structure:
```markdown
# Website Name

> Website Description

## Website
- [Homepage Title](URL) - Homepage Description
- [Single Page Title](URL) - Page Description

## Section Name (for directories with subpages)
- [Page Title](URL) - Page Description
- [Another Page](URL) - Page Description

## Custom Section (for multiple domains)
- [Domain 1 Page](URL) - Page Description
- [Domain 2 Page](URL) - Page Description
```

## Adding to Your Website

1. Place the generated `llms.txt` file in the root directory of your website (same level as your homepage)
2. Ensure the file is accessible via: `https://yourdomain.com/llms.txt`
3. Add the following meta tag to your website's `<head>` section:
```html
<link rel="llms-txt" type="text/plain" href="/llms.txt" />
```
> [!NOTE]  
> Depending on your hosting provider, you may not be able to place the file in the root directly. In that case, please follow the hosting providers recommendation on where to place well known files. 


## Requirements

- Node.js 14.0.0 or higher
- NPM 6.0.0 or higher

## Dependencies

- axios: For making HTTP requests
- cheerio: For parsing HTML and extracting metadata
- xml2js: For parsing XML sitemaps
- inquirer: For interactive command line interface

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 