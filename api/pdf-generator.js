const https = require('https');

// Funcție pentru cereri HTTP
async function makeRequest(url, options, data) {
  console.log(`Making request to: ${url}`);
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          let errorMessage = `HTTP request failed with status ${res.statusCode}`;
          try {
            const errorBody = body.toString('utf8');
            errorMessage += `: ${errorBody}`;
          } catch (e) {}
          
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Generează CSS pentru a elimina secțiunile specificate
function generateRemovalCSS(sectionsToRemove) {
  if (!sectionsToRemove || sectionsToRemove.length === 0) {
    return '';
  }
  
  return sectionsToRemove.map(selector => `
    ${selector} {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
    }
  `).join('\n');
}

// CSS pentru a deschide toate elementele acordeon
function getAccordionStyles() {
  return `
    /* Force all accordion elements to be visible */
    [data-toggle="collapse"],
    [aria-expanded="false"],
    .accordion-button.collapsed,
    .accordion-collapse.collapse:not(.show),
    .collapse:not(.show),
    [class*="collapsed"] {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    /* Ensure accordion content is visible */
    .accordion-body, 
    .collapse, 
    .accordion-collapse {
      height: auto !important;
      max-height: none !important;
      display: block !important;
    }
    
    /* Remove common interfering elements */
    .sticky-top, 
    .fixed-top, 
    .fixed-bottom,
    nav.navbar-fixed, 
    .cookie-banner,
    #cookie-notice,
    [id*="cookie"],
    [class*="cookie"],
    [id*="popup"],
    [class*="popup"],
    [class*="banner"],
    [id*="banner"],
    [class*="modal"],
    [id*="modal"],
    [class*="dialog"],
    [id*="dialog"] {
      display: none !important;
    }
    
    /* Make images reasonable size */
    img {
      max-width: 100% !important;
      height: auto !important;
      max-height: 500px !important;
    }

    /* Improve readability */
    body {
      font-family: Arial, sans-serif !important;
      padding: 20px !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
    }
    
    pre, code {
      white-space: pre-wrap !important;
      max-width: 100% !important;
      overflow-x: auto !important;
    }
  `;
}

// JavaScript pentru a deschide elementele acordeon
function getAccordionScript() {
  return `
    function expandAccordions() {
      // Bootstrap accordions
      document.querySelectorAll('.accordion-button.collapsed').forEach(button => {
        button.classList.remove('collapsed');
        button.setAttribute('aria-expanded', 'true');
      });
      
      document.querySelectorAll('.accordion-collapse.collapse:not(.show)').forEach(collapse => {
        collapse.classList.add('show');
      });
      
      // General accordions by aria-expanded attribute
      document.querySelectorAll('[aria-expanded="false"]').forEach(elem => {
        elem.setAttribute('aria-expanded', 'true');
      });
      
      // Collapse elements
      document.querySelectorAll('.collapse:not(.show)').forEach(collapse => {
        collapse.classList.add('show');
        collapse.style.height = 'auto';
      });
      
      // Toggle buttons
      document.querySelectorAll('[data-toggle="collapse"]').forEach(toggle => {
        toggle.setAttribute('aria-expanded', 'true');
      });
    }
    
    // Execute after page load
    window.addEventListener('DOMContentLoaded', expandAccordions);
    
    // Also try after a short delay
    setTimeout(expandAccordions, 1000);
  `;
}

// Funcție pentru a genera un PDF cu toate URL-urile într-un singur document
async function generatePDF(job) {
  try {
    console.log('Generating PDF using Browserless.io...');
    
    // Verifică API key
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
    if (!browserlessApiKey) {
      throw new Error('Browserless API key is not configured');
    }
    
    // Verificăm dacă avem URL-uri
    if (!job.urls || job.urls.length === 0) {
      throw new Error('No URLs provided for PDF generation');
    }
    
    console.log(`Processing ${job.urls.length} URLs in a single PDF`);
    
    // Combinăm stilurile CSS standard cu cele pentru eliminarea secțiunilor specifice
    const customCSS = getAccordionStyles() + 
                     generateRemovalCSS(job.options?.sectionsToRemove || []);
    
    const options = {
      method: 'POST',
      hostname: 'chrome.browserless.io',
      path: `/pdf?token=${browserlessApiKey}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Utilizăm funcția /pdf-multiple a browserless.io pentru a genera un singur PDF din mai multe URL-uri
    const requestBody = JSON.stringify({
      urls: job.urls,
      options: {
        printBackground: true,
        format: job.options?.pageSize || 'A4',
        landscape: job.options?.landscape || false,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="width: 100%; font-size: 10px; text-align: center; color: #666;">
            <span>${job.name || 'PDF Report'}</span>
          </div>
        `,
        footerTemplate: `
          <div style="width: 100%; font-size: 10px; text-align: center; color: #666;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `
      },
      gotoOptions: {
        timeout: 60000,
        waitUntil: 'networkidle2'
      },
      emulateMedia: 'screen',
      addStyleTag: [{ content: customCSS }],
      addScriptTag: [{ content: getAccordionScript() }]
    });
    
    try {
      // Folosim endpoint-ul specific pentru multiple URLs
      const pdfBuffer = await makeRequest(
        `https://chrome.browserless.io/pdf-multiple?token=${browserlessApiKey}`,
        options,
        requestBody
      );
      
      console.log(`Generated combined PDF, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;
    } catch (error) {
      // Dacă pdf-multiple nu este disponibil, încercăm cu metoda tradițională
      console.error('Error with pdf-multiple endpoint:', error);
      console.log('Falling back to single URL method and concatenating results');
      
      // Aici ar trebui să implementăm o soluție alternativă
      throw new Error(`Browserless.io error: ${error.message}. Ensure you have access to the pdf-multiple endpoint.`);
    }
    
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}

module.exports = {
  generatePDF
};
