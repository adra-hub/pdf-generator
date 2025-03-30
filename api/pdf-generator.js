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

// Funcția pentru a combina mai multe PDF-uri în unul singur
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
        path: `/function?token=${browserlessApiKey}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Pregătim scenariu care va fi executat de browserless
      // Această abordare ne dă control complet asupra browserului
      const scriptCode = `
        module.exports = async ({ page, context }) => {
          const { url, options, sectionsToRemove } = context;
          
          // Configurăm pagina
          await page.setViewport({ width: 1200, height: 800 });
          
          // Navigăm la URL
          console.log('Navigating to URL:', url);
          await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          // Injectăm CSS pentru a elimina secțiunile specificate
          if (sectionsToRemove && sectionsToRemove.length > 0) {
            console.log('Removing sections:', sectionsToRemove);
            
            const cssContent = sectionsToRemove.map(selector => `
              ${selector} {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                height: 0 !important;
                position: absolute !important;
                pointer-events: none !important;
                left: -9999px !important;
              }
            `).join('\\n');
            
            await page.addStyleTag({ content: cssContent });
            
            // Încercăm și o abordare JavaScript pentru a elimina elementele
            for (const selector of sectionsToRemove) {
              try {
                await page.evaluate((sel) => {
                  document.querySelectorAll(sel).forEach(el => {
                    if (el && el.parentNode) {
                      el.parentNode.removeChild(el);
                    }
                  });
                }, selector);
              } catch (e) {
                console.log('Error removing element with selector:', selector, e);
              }
            }
          }
          
          // Expandăm acordeoanele - abordare cu evaluate pentru a avea acces direct la DOM
          await page.evaluate(() => {
            // Funcție pentru a expanda acordeoanele
            function expandAccordions() {
              // Selectori comuni pentru acordeoane
              const selectors = [
                '.accordion-button.collapsed',
                '.accordion-collapse.collapse:not(.show)',
                '.collapse:not(.show)',
                'details:not([open])',
                '[aria-expanded="false"]',
                '.accordion-header button',
                '.accordion [data-bs-toggle="collapse"]',
                '[data-toggle="collapse"]',
                '.accordion .card-header button'
              ];
              
              // Procesăm fiecare selector
              selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                  try {
                    // Acordeoane Bootstrap
                    if (el.classList.contains('accordion-button') || 
                        el.hasAttribute('data-bs-toggle') || 
                        el.hasAttribute('data-toggle')) {
                      el.classList.remove('collapsed');
                      el.setAttribute('aria-expanded', 'true');
                      
                      // Găsim collapseul asociat
                      let target = el.getAttribute('data-bs-target') || 
                                  el.getAttribute('data-target') || 
                                  el.getAttribute('href');
                      
                      if (target && target.startsWith('#')) {
                        let collapse = document.querySelector(target);
                        if (collapse) {
                          collapse.classList.add('show');
                          collapse.style.height = 'auto';
                          collapse.style.maxHeight = 'none';
                        }
                      }
                    }
                    // Elemente collapse
                    else if (el.classList.contains('collapse') || 
                             el.classList.contains('accordion-collapse')) {
                      el.classList.add('show');
                      el.style.height = 'auto';
                      el.style.maxHeight = 'none';
                    }
                    // Elemente details
                    else if (el.tagName === 'DETAILS') {
                      el.setAttribute('open', 'true');
                    }
                    // Orice element cu aria-expanded
                    else if (el.hasAttribute('aria-expanded')) {
                      el.setAttribute('aria-expanded', 'true');
                    }
                  } catch (e) {
                    console.error('Error expanding accordion element:', e);
                  }
                });
              });
              
              // Forțăm toate elementele de tip collapse să fie vizibile
              document.querySelectorAll('.collapse, .accordion-collapse').forEach(el => {
                el.classList.add('show');
                el.style.height = 'auto';
                el.style.maxHeight = 'none';
                el.style.display = 'block';
              });
            }
            
            // Executăm funcția și apoi o executăm și după un delay
            expandAccordions();
            setTimeout(expandAccordions, 1000);
            
            // Adăugăm și CSS pentru a forța acordeoanele să fie deschise
            const style = document.createElement('style');
            style.textContent = \`
              .collapse, .accordion-collapse { 
                display: block !important; 
                height: auto !important; 
                max-height: none !important;
                visibility: visible !important;
                opacity: 1 !important;
              }
              [aria-expanded="false"] { 
                display: block !important;
                visibility: visible !important;
              }
              details:not([open]) { 
                display: block !important;
              }
              details:not([open]) > * { 
                display: block !important;
              }
              .accordion-button.collapsed::after {
                transform: rotate(180deg) !important;
              }
            \`;
            document.head.appendChild(style);
          });
          
          // Așteptăm puțin pentru a permite elementelor să se actualizeze
          await page.waitForTimeout(2000);
          
          // Generăm PDF
          console.log('Generating PDF...');
          const pdfBuffer = await page.pdf({
            format: options.pageSize || 'A4',
            landscape: options.landscape || false,
            printBackground: true,
            margin: options.margins || {
              top: '20px',
              right: '20px',
              bottom: '20px',
              left: '20px'
            },
            displayHeaderFooter: true,
            headerTemplate: \`
              <div style="width: 100%; font-size: 10px; text-align: center; color: #666;">
                <span>\${options.name || 'PDF Report'}</span>
              </div>
            \`,
            footerTemplate: \`
              <div style="width: 100%; font-size: 10px; text-align: center; color: #666;">
                <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
              </div>
            \`
          });
          
          return pdfBuffer;
        };
      `;
      
      // Pregătim body-ul cererii cu scriptul
      const requestBody = JSON.stringify({
        code: scriptCode,
        context: {
          url: url,
          options: {
            pageSize: job.options?.pageSize || 'A4',
            landscape: job.options?.landscape || false,
            name: job.name || 'PDF Report',
            margins: {
              top: '20px',
              right: '20px',
              bottom: '20px',
              left: '20px'
            }
          },
          sectionsToRemove: job.options?.sectionsToRemove || []
        }
      });
      
      try {
        console.log(`Sending request to Browserless.io for URL: ${url}`);
        const pdfBuffer = await makeRequest(
          `https://chrome.browserless.io/function?token=${browserlessApiKey}`,
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
