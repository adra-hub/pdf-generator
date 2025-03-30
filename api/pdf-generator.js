const https = require('https');

// Funcție îmbunătățită pentru a face cereri HTTP cu logging
async function makeRequest(url, options, data) {
  console.log(`Making request to: ${url}`);
  console.log(`Request options:`, JSON.stringify(options));
  console.log(`Request body:`, data);
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        console.log(`Response status: ${res.statusCode}`);
        
        // Dacă avem un răspuns de eroare, încercăm să îl formatăm pentru debugging
        if (res.statusCode >= 400) {
          let responseBody = "";
          try {
            responseBody = body.toString('utf8');
            console.log(`Error response body: ${responseBody}`);
          } catch (e) {
            console.log(`Could not parse error response: ${e.message}`);
          }
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP request failed with status ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`Request error:`, error);
      reject(error);
    });

    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Funcție corectată pentru generarea PDF-ului
async function generatePDF(job) {
  try {
    console.log('Generating PDF using Browserless.io...');
    console.log('Job details:', JSON.stringify(job));
    
    // Verifică API key
    const browserlessApiKey = process.env.BROWSERLESS_API_KEY;
    if (!browserlessApiKey) {
      throw new Error('Browserless API key is not configured');
    }
    
    // Verificăm dacă avem cel puțin un URL
    if (!job.urls || job.urls.length === 0) {
      throw new Error('No URLs provided for PDF generation');
    }
    
    // Folosim doar primul URL pentru simplitate
    const url = job.urls[0];
    console.log(`Processing URL: ${url}`);
    
    const options = {
      method: 'POST',
      hostname: 'chrome.browserless.io',
      path: `/pdf?token=${browserlessApiKey}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Folosim un format simplu, conform documentației Browserless
    // https://www.browserless.io/docs/pdf
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
      }
    });
    
    console.log('Sending request to Browserless.io...');
    const pdfBuffer = await makeRequest(
      `https://chrome.browserless.io/pdf?token=${browserlessApiKey}`,
      options,
      requestBody
    );
    
    console.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);
    return pdfBuffer;
    
  } catch (error) {
    console.error('Error in PDF generation:', error);
    throw error;
  }
}

module.exports = {
  generatePDF
};
