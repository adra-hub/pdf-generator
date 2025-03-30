const https = require('https');

// Funcție pentru a face cereri HTTP
async function makeRequest(url, options, data) {
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
    
    // Setăm un timeout de 60 secunde
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timeout after 60 seconds'));
    });
  });
}

// CSS pentru a deschide acordeoanele și a elimina secțiunile specificate
function generateCSS(sectionsToRemove = []) {
  let css = `
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
      max-height: 400px !important;
    }

    /* Improve readability */
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
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

  // Adăugăm CSS pentru secțiunile de eliminat
  if (sectionsToRemove && sectionsToRemove.length > 0) {
    const removalCSS = sectionsToRemove.map(selector => `
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
    
    css += '\n' + removalCSS;
  }
  
  return css;
}

// JavaScript pentru a deschide acordeoanele
function getAccordionScript() {
  return `
    function expandAccordions() {
      // Bootstrap accordions
      document.querySelectorAll('.accordion-button.collapsed').forEach(button => {
        try {
          button.classList.remove('collapsed');
          button.setAttribute('aria-expanded', 'true');
        } catch(e) {}
      });
      
      document.querySelectorAll('.accordion-collapse.collapse:not(.show)').forEach(collapse => {
        try {
          collapse.classList.add('show');
        } catch(e) {}
      });
      
      // General accordions by aria-expanded attribute
      document.querySelectorAll('[aria-expanded="false"]').forEach(elem => {
        try {
          elem.setAttribute('aria-expanded', 'true');
        } catch(e) {}
      });
      
      // Collapse elements
      document.querySelectorAll('.collapse:not(.show)').forEach(collapse => {
        try {
          collapse.classList.add('show');
          collapse.style.height = 'auto';
        } catch(e) {}
      });
      
      // Toggle buttons
      document.querySelectorAll('[data-toggle="collapse"]').forEach(toggle => {
        try {
          toggle.setAttribute('aria-expanded', 'true');
        } catch(e) {}
      });
    }
    
    // Execute after page load
    window.addEventListener('DOMContentLoaded', expandAccordions);
    
    // Also try after a short delay
    setTimeout(expandAccordions, 1000);
  `;
}

// Funcție pentru a genera un PDF cu toate URL-urile
async function generatePDF(job) {
  try {
    console.log('Generating PDF using Browserless.io...');
    console.log('Job details:', JSON.stringify(job, null, 2));
    
    // Verifică API key
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
    if (!browserlessApiKey) {
      throw new Error('Browserless API key is not configured');
    }
    
    // Verifică dacă avem URL-uri
    if (!job.urls || job.urls.length === 0) {
      throw new Error('No URLs provided for PDF generation');
    }
    
    console.log(`Processing ${job.urls.length} URLs individually...`);
    
    // Procesăm fiecare URL individual
    const pdfBuffers = [];
    
    for (let i = 0; i < job.urls.length; i++) {
      const url = job.urls[i];
      console.log(`Processing URL ${i+1}/${job.urls.length}: ${url}`);
      
      const options = {
        method: 'POST',
        hostname: 'chrome.browserless.io',
        path: `/pdf?token=${browserlessApiKey}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Generăm CSS personalizat care include secțiunile de eliminat
      const customCSS = generateCSS(job.options?.sectionsToRemove || []);
      
      // Pregătim body-ul cererii
      const requestBody = JSON.stringify({
        url: url,
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
          waitUntil: 'networkidle2',
          timeout: 30000
        },
        addStyleTag: [{ content: customCSS }],
        addScriptTag: [{ content: getAccordionScript() }]
      });
      
      try {
        console.log(`Sending request to Browserless.io for URL: ${url}`);
        const pdfBuffer = await makeRequest(
          `https://chrome.browserless.io/pdf?token=${browserlessApiKey}`,
          options,
          requestBody
        );
        
        console.log(`Successfully generated PDF for URL ${i+1}, size: ${pdfBuffer.length} bytes`);
        pdfBuffers.push(pdfBuffer);
      } catch (error) {
        console.error(`Error generating PDF for URL ${i+1}:`, error);
        // Continuăm cu celelalte URL-uri chiar dacă unul eșuează
      }
    }
    
    // Verificăm dacă am generat cel puțin un PDF
    if (pdfBuffers.length === 0) {
      throw new Error('Could not generate any PDFs. Check the Browserless.io API key and URLs.');
    }
    
    console.log(`Successfully generated ${pdfBuffers.length} out of ${job.urls.length} PDFs`);
    
    // Pentru moment, returnăm doar primul PDF generat cu succes
    // În viitor, se poate implementa combinarea PDF-urilor folosind pdf-lib
    return pdfBuffers[0];
    
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}

module.exports = {
  generatePDF
};
