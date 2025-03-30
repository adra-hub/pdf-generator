async function generatePDF(job) {
  try {
    console.log('Generating PDF using Browserless.io...');
    
    // Verificăm API key
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
    if (!browserlessApiKey) {
      throw new Error('Browserless API key is not configured');
    }
    
    // Procesăm fiecare URL individual
    const pdfBuffers = [];
    console.log(`Processing ${job.urls.length} URLs individually...`);
    
    for (const url of job.urls) {
      console.log(`Processing URL: ${url}`);
      
      const options = {
        method: 'POST',
        hostname: 'chrome.browserless.io',
        path: `/pdf?token=${browserlessApiKey}`,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Generăm CSS pentru secțiunile de eliminat
      let customCSS = '';
      if (job.options.sectionsToRemove && job.options.sectionsToRemove.length > 0) {
        customCSS = job.options.sectionsToRemove.map(selector => `
          ${selector} {
            display: none !important;
            visibility: hidden !important;
          }
        `).join('\n');
      }
      
      // Adăugăm CSS pentru acordeoane
      customCSS += `
        /* Force all accordion elements to be visible */
        [data-toggle="collapse"],
        [aria-expanded="false"],
        .accordion-button.collapsed,
        .accordion-collapse.collapse:not(.show),
        .collapse:not(.show),
        [class*="collapsed"] {
          display: block !important;
          visibility: visible !important;
          height: auto !important;
        }
      `;
      
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
          }
        },
        addStyleTag: [{ content: customCSS }],
        addScriptTag: [{
          content: `
            // Expand accordions
            document.addEventListener('DOMContentLoaded', function() {
              // Bootstrap accordions
              document.querySelectorAll('.accordion-button.collapsed').forEach(button => {
                button.classList.remove('collapsed');
                button.setAttribute('aria-expanded', 'true');
              });
              
              document.querySelectorAll('.accordion-collapse.collapse:not(.show)').forEach(collapse => {
                collapse.classList.add('show');
              });
              
              // Generic accordions
              document.querySelectorAll('[aria-expanded="false"]').forEach(elem => {
                elem.setAttribute('aria-expanded', 'true');
              });
              
              document.querySelectorAll('.collapse:not(.show)').forEach(collapse => {
                collapse.classList.add('show');
              });
            });
          `
        }]
      });
      
      try {
        const pdfBuffer = await makeRequest(
          `https://chrome.browserless.io/pdf?token=${browserlessApiKey}`,
          options,
          requestBody
        );
        
        pdfBuffers.push(pdfBuffer);
        console.log(`Generated PDF for URL: ${url}, size: ${pdfBuffer.length} bytes`);
      } catch (error) {
        console.error(`Error generating PDF for URL: ${url}`, error);
        // Continue with other URLs even if one fails
      }
    }
    
    // Verificăm dacă am generat cel puțin un PDF
    if (pdfBuffers.length === 0) {
      throw new Error('Failed to generate any PDFs. Check the Browserless.io API key and URLs.');
    }
    
    // Dacă avem doar un PDF, îl returnăm direct
    if (pdfBuffers.length === 1) {
      return pdfBuffers[0];
    }
    
    // Dacă avem mai multe PDF-uri, le combinăm (ar trebui să adaugi o bibliotecă pentru asta)
    // Pentru moment, returnăm doar primul PDF
    console.log(`Returning first PDF (of ${pdfBuffers.length} total)`);
    return pdfBuffers[0];
    
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}
