const https = require('https');
const { PDFDocument } = require('pdf-lib');

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
  // CSS de bază pentru styling-ul general
  let css = `
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
    
    /* Force all accordion elements to be visible */
    details:not([open]), 
    [aria-expanded="false"],
    .accordion-button.collapsed,
    .accordion-collapse.collapse:not(.show),
    .collapse:not(.show) {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
    
    /* Ensure accordion content is visible */
    details > *,
    .accordion-body, 
    .collapse, 
    .accordion-collapse,
    [role="tabpanel"] {
      display: block !important;
      height: auto !important;
      max-height: none !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    /* Bootstrap specific accordions */
    .accordion-button.collapsed::after {
      transform: rotate(180deg) !important;
    }
    
    /* Remove common interfering elements */
    .sticky-top, 
    .fixed-top, 
    .fixed-bottom,
    nav.navbar-fixed, 
    .cookie-banner,
    #cookie-notice,
    [id*="cookie-"],
    [class*="cookie-"],
    [id*="popup"],
    [class*="popup"],
    #overlay,
    .overlay,
    .modal,
    .dialog {
      display: none !important;
      visibility: hidden !important;
    }
  `;

  // Adăugăm CSS pentru secțiunile de eliminat
  if (sectionsToRemove && sectionsToRemove.length > 0) {
    console.log(`Adding CSS for removing sections: ${sectionsToRemove.join(', ')}`);
    const removalCSS = sectionsToRemove.map(selector => {
      // Asigurăm că selectorul este valabil
      try {
        document.querySelector(selector);
        return `
          ${selector} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
      } catch (e) {
        // Dacă selectorul nu e valid, încercăm să-l corectăm
        // Selectorul poate conține caractere care trebuie escape-uite
        const escapedSelector = selector.replace(/"/g, '\\"').replace(/'/g, "\\'");
        return `
          ${escapedSelector} {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            left: -9999px !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        `;
      }
    }).join('\n');
    
    css += '\n' + removalCSS;
  }
  
  return css;
}

// JavaScript pentru a deschide acordeoanele
function getAccordionScript() {
  return `
    function expandAllAccordions() {
      // Expand all details elements
      document.querySelectorAll('details').forEach(detail => {
        detail.setAttribute('open', 'true');
      });
      
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
          collapse.style.display = 'block';
        } catch(e) {}
      });
      
      // Toggle buttons
      document.querySelectorAll('[data-toggle="collapse"]').forEach(toggle => {
        try {
          toggle.setAttribute('aria-expanded', 'true');
        } catch(e) {}
      });
      
      // Any elements with a hidden state
      document.querySelectorAll('[aria-hidden="true"]').forEach(elem => {
        try {
          if (elem.classList.contains('accordion-body') || 
              elem.classList.contains('collapse') ||
              elem.closest('.accordion')) {
            elem.setAttribute('aria-hidden', 'false');
          }
        } catch(e) {}
      });
      
      // Force any tab panels to be visible
      document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
        try {
          panel.style.display = 'block';
          panel.style.visibility = 'visible';
          panel.style.height = 'auto';
          panel.style.opacity = '1';
        } catch(e) {}
      });
      
      console.log('All accordions and collapsible elements expanded');
    }
    
    // Execute after initial page load
    document.addEventListener('DOMContentLoaded', function() {
      expandAllAccordions();
      
      // Set a timeout for delayed elements
      setTimeout(expandAllAccordions, 1000);
    });
    
    // Run again after all resources are loaded
    window.addEventListener('load', function() {
      expandAllAccordions();
      
      // Run again after a delay for any dynamic content
      setTimeout(expandAllAccordions, 2000);
    });
    
    // Also remove sections programmatically that might be difficult to target with CSS
    function removeElementsBySelectors(selectors) {
      if (!selectors || !selectors.length) return;
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            try {
              el.style.display = 'none';
              el.style.visibility = 'hidden';
              // Also try removing from DOM
              if (el.parentNode) {
                el.parentNode.removeChild(el);
              }
            } catch(e) {}
          });
        } catch(e) {}
      });
    }
    
    setTimeout(function() {
      // Selector list would be injected here dynamically
      removeElementsBySelectors(SELECTOR_LIST_PLACEHOLDER);
    }, 1500);
  `;
}

// Funcție pentru a combina mai multe PDF-uri în unul singur
async function mergePDFs(pdfBuffers) {
  try {
    console.log(`Merging ${pdfBuffers.length} PDFs into one document...`);
    
    // Creare PDF gol
    const mergedPdf = await PDFDocument.create();
    
    // Adăugare pagini din fiecare PDF
    for (let i = 0; i < pdfBuffers.length; i++) {
      try {
        const pdf = await PDFDocument.load(pdfBuffers[i]);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => {
          mergedPdf.addPage(page);
        });
        console.log(`Added ${copiedPages.length} pages from PDF ${i+1}`);
      } catch (error) {
        console.error(`Error adding PDF ${i+1} to merged document:`, error);
      }
    }
    
    // Salvare ca Buffer
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Error merging PDFs:', error);
    // Dacă combinarea eșuează, returnează primul PDF
    return pdfBuffers[0];
  }
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
      
      // Injectăm lista de selectori în scriptul de acordeoane
      const selectorsJson = JSON.stringify(job.options?.sectionsToRemove || []);
      const accordionScript = getAccordionScript().replace('SELECTOR_LIST_PLACEHOLDER', selectorsJson);
      
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
          timeout: 40000
        },
        addStyleTag: [{ content: customCSS }],
        addScriptTag: [{ content: accordionScript }]
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
    
    // Dacă avem doar un PDF, îl returnăm direct
    if (pdfBuffers.length === 1) {
      return pdfBuffers[0];
    }
    
    // Combinăm toate PDF-urile într-unul singur
    const mergedPdf = await mergePDFs(pdfBuffers);
    return mergedPdf;
    
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}

module.exports = {
  generatePDF
};
