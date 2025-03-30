const https = require('https');
const PDFDocument = require('pdf-lib').PDFDocument;

// Funcție pentru a face cereri HTTP
function makeRequest(url, options, data) {
  return new Promise(function(resolve, reject) {
    const req = https.request(url, options, function(res) {
      const chunks = [];
      res.on('data', function(chunk) { 
        chunks.push(chunk); 
      });
      
      res.on('end', function() {
        const body = Buffer.concat(chunks);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          let errorMessage = 'HTTP request failed with status ' + res.statusCode;
          try {
            const errorBody = body.toString('utf8');
            errorMessage += ': ' + errorBody;
          } catch (e) {}
          
          reject(new Error(errorMessage));
        }
      });
    });

    req.on('error', function(error) {
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
    
    // Setăm un timeout de 60 secunde
    req.setTimeout(60000, function() {
      req.destroy(new Error('Request timeout after 60 seconds'));
    });
  });
}

// Funcția pentru a combina mai multe PDF-uri în unul singur
function mergePDFs(pdfBuffers) {
  return new Promise(function(resolve, reject) {
    try {
      console.log('Merging ' + pdfBuffers.length + ' PDFs into one document...');
      
      // Pentru simplitate, dacă avem un singur PDF, îl returnăm direct
      if (pdfBuffers.length === 1) {
        return resolve(pdfBuffers[0]);
      }
      
      // Dacă avem pdf-lib, folosim-o pentru a combina PDF-urile
      PDFDocument.create().then(function(mergedPdf) {
        // Funcție recursivă pentru a procesa PDF-urile pe rând
        function processNext(index) {
          if (index >= pdfBuffers.length) {
            // Am terminat, salvăm rezultatul
            mergedPdf.save().then(function(mergedPdfBytes) {
              resolve(Buffer.from(mergedPdfBytes));
            }).catch(reject);
            return;
          }
          
          // Procesăm PDF-ul curent
          PDFDocument.load(pdfBuffers[index]).then(function(pdf) {
            const pageIndices = Array.from({ length: pdf.getPageCount() }, function(_, i) { return i; });
            mergedPdf.copyPages(pdf, pageIndices).then(function(copiedPages) {
              copiedPages.forEach(function(page) {
                mergedPdf.addPage(page);
              });
              console.log('Added ' + copiedPages.length + ' pages from PDF ' + (index + 1));
              // Procesăm următorul PDF
              processNext(index + 1);
            }).catch(function(err) {
              console.error('Error copying pages from PDF ' + (index + 1) + ':', err);
              // Continuăm cu următorul PDF chiar dacă avem o eroare
              processNext(index + 1);
            });
          }).catch(function(err) {
            console.error('Error loading PDF ' + (index + 1) + ':', err);
            // Continuăm cu următorul PDF chiar dacă avem o eroare
            processNext(index + 1);
          });
        }
        
        // Începem procesarea de la primul PDF
        processNext(0);
        
      }).catch(function(err) {
        console.error('Error creating merged PDF:', err);
        // Dacă eșuează, returnăm primul PDF
        resolve(pdfBuffers[0]);
      });
      
    } catch (error) {
      console.error('Error in mergePDFs:', error);
      // Dacă combinarea eșuează, returnează primul PDF
      resolve(pdfBuffers[0]);
    }
  });
}

// Funcție pentru a genera un PDF
function generatePDF(job) {
  return new Promise(function(resolve, reject) {
    try {
      console.log('Generating PDF using Browserless.io...');
      
      // Verifică API key
      const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
      if (!browserlessApiKey) {
        throw new Error('Browserless API key is not configured');
      }
      
      // Verifică dacă avem URL-uri
      if (!job.urls || job.urls.length === 0) {
        throw new Error('No URLs provided for PDF generation');
      }
      
      console.log('Processing ' + job.urls.length + ' URLs individually...');
      
      // Procesăm fiecare URL individual
      const pdfPromises = [];
      
      for (let i = 0; i < job.urls.length; i++) {
        const url = job.urls[i];
        
        // Creăm funcția pentru a genera PDF-ul pentru acest URL
        const generateSinglePDF = function() {
          return new Promise(function(pdfResolve, pdfReject) {
            console.log('Processing URL ' + (i+1) + '/' + job.urls.length + ': ' + url);
          
            const options = {
              method: 'POST',
              hostname: 'chrome.browserless.io',
              path: '/pdf?token=' + browserlessApiKey,
              headers: {
                'Content-Type': 'application/json'
              }
            };
            
            // Preparăm CSS pentru a elimina secțiuni și a deschide acordeoane
            let customCSS = `
              /* Make images reasonable size */
              img {
                max-width: 100% !important;
                height: auto !important;
                max-height: 400px !important;
              }
            
              /* Force all accordion elements to be visible */
              [aria-expanded="false"],
              .accordion-button.collapsed,
              .accordion-collapse.collapse:not(.show),
              .collapse:not(.show) {
                display: block !important;
                visibility: visible !important;
                height: auto !important;
                max-height: none !important;
              }
              
              /* Any Bootstrap accordion */
              .accordion-body, 
              .collapse, 
              .accordion-collapse {
                display: block !important;
                height: auto !important;
                max-height: none !important;
              }
              
              /* Remove common interfering elements */
              .sticky-top, 
              .fixed-top, 
              .fixed-bottom,
              nav.navbar-fixed,
              .cookie-banner,
              #cookie-notice {
                display: none !important;
              }
            `;
            
            // Adăugăm CSS pentru secțiunile de eliminat
            if (job.options && job.options.sectionsToRemove && job.options.sectionsToRemove.length > 0) {
              for (let j = 0; j < job.options.sectionsToRemove.length; j++) {
                const selector = job.options.sectionsToRemove[j];
                customCSS += `
                  ${selector} {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    max-height: 0 !important;
                    overflow: hidden !important;
                    position: absolute !important;
                    left: -9999px !important;
                  }
                `;
              }
            }
            
            // Scriem JavaScript pentru a deschide acordeoanele
            const accordionScript = `
              function expandAccordions() {
                // Bootstrap accordions
                var accordionButtons = document.querySelectorAll('.accordion-button.collapsed');
                for (var i = 0; i < accordionButtons.length; i++) {
                  try {
                    accordionButtons[i].classList.remove('collapsed');
                    accordionButtons[i].setAttribute('aria-expanded', 'true');
                  } catch(e) {}
                }
                
                var accordionCollapse = document.querySelectorAll('.accordion-collapse.collapse:not(.show)');
                for (var i = 0; i < accordionCollapse.length; i++) {
                  try {
                    accordionCollapse[i].classList.add('show');
                  } catch(e) {}
                }
                
                // General accordions by aria-expanded attribute
                var ariaCollapsed = document.querySelectorAll('[aria-expanded="false"]');
                for (var i = 0; i < ariaCollapsed.length; i++) {
                  try {
                    ariaCollapsed[i].setAttribute('aria-expanded', 'true');
                  } catch(e) {}
                }
                
                // Collapse elements
                var collapseElements = document.querySelectorAll('.collapse:not(.show)');
                for (var i = 0; i < collapseElements.length; i++) {
                  try {
                    collapseElements[i].classList.add('show');
                    collapseElements[i].style.height = 'auto';
                  } catch(e) {}
                }
                
                // Remove sections programmatically
                var sectionsToRemove = ${JSON.stringify(job.options && job.options.sectionsToRemove ? job.options.sectionsToRemove : [])};
                for (var i = 0; i < sectionsToRemove.length; i++) {
                  try {
                    var elements = document.querySelectorAll(sectionsToRemove[i]);
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j] && elements[j].parentNode) {
                        elements[j].parentNode.removeChild(elements[j]);
                      }
                    }
                  } catch(e) {}
                }
              }
              
              // Execute after page load
              expandAccordions();
              
              // Also try after a short delay
              setTimeout(expandAccordions, 1000);
            `;
            
            // Pregătim body-ul cererii
            const requestBody = JSON.stringify({
              url: url,
              options: {
                printBackground: true,
                format: job.options && job.options.pageSize ? job.options.pageSize : 'A4',
                landscape: job.options && job.options.landscape ? job.options.landscape : false,
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
              addScriptTag: [{ content: accordionScript }]
            });
            
            console.log('Sending request to Browserless.io for URL: ' + url);
            makeRequest(
              'https://chrome.browserless.io/pdf?token=' + browserlessApiKey,
              options,
              requestBody
            ).then(function(pdfBuffer) {
              console.log('Successfully generated PDF for URL ' + (i+1) + ', size: ' + pdfBuffer.length + ' bytes');
              pdfResolve(pdfBuffer);
            }).catch(function(error) {
              console.error('Error generating PDF for URL ' + (i+1) + ':', error);
              pdfReject(error);
            });
          });
        };
        
        // Adăugăm promisiunea la array
        pdfPromises.push(generateSinglePDF());
      }
      
      // Așteptăm ca toate PDF-urile să fie generate
      Promise.all(pdfPromises.map(function(promise) {
        // Convertim promisiunile pentru a nu eșua
        return promise.catch(function(err) {
          console.error('Error in PDF generation:', err);
          return null; // returnăm null pentru promisiuni eșuate
        });
      })).then(function(results) {
        // Filtrăm rezultatele nule
        const pdfBuffers = results.filter(function(result) {
          return result !== null;
        });
        
        // Verificăm dacă am generat cel puțin un PDF
        if (pdfBuffers.length === 0) {
          throw new Error('Could not generate any PDFs. Check the Browserless.io API key and URLs.');
        }
        
        console.log('Successfully generated ' + pdfBuffers.length + ' out of ' + job.urls.length + ' PDFs');
        
        // Combinăm PDF-urile
        mergePDFs(pdfBuffers).then(function(mergedPdf) {
          resolve(mergedPdf);
        }).catch(function(error) {
          console.error('Error merging PDFs:', error);
          // Dacă eșuează combinarea, returnăm primul PDF
          resolve(pdfBuffers[0]);
        });
      }).catch(function(error) {
        reject(error);
      });
      
    } catch (error) {
      console.error('Error in PDF generation:', error);
      reject(error);
    }
  });
}

module.exports = {
  generatePDF: generatePDF
};
