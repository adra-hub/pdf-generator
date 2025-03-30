require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Corectare pentru versiuni mai vechi de Node.js
const pdfGenerator = require('./api/pdf-generator');
const generatePDF = pdfGenerator.generatePDF;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rute
app.get('/', (req, res) => {
  res.send('PDF Generator Service is running. Use /generate-pdf endpoint to generate PDFs.');
});

// Ruta pentru generarea PDF
app.get('/generate-pdf', async (req, res) => {
  try {
    const { id, urls, sectionsToRemove } = req.query;
    
    if (!id && !urls) {
      return res.status(400).send('Missing job ID or URLs');
    }
    
    // Dacă ai URLs în query string, le folosim direct
    let job;
    if (urls) {
      // Convertim string-ul de URL-uri separate prin virgulă într-un array
      const urlsArray = urls.split(',').map(url => url.trim()).filter(url => url);
      
      console.log(`Processing URLs: ${JSON.stringify(urlsArray)}`);
      
      // Verificăm dacă avem cel puțin un URL valid
      if (urlsArray.length === 0) {
        return res.status(400).send('No valid URLs provided');
      }
      
      // Validăm URL-urile pentru a ne asigura că sunt formate corect
      const validUrls = urlsArray.filter(url => {
        try {
          new URL(url);
          return true;
        } catch (e) {
          console.warn(`Invalid URL: ${url}`);
          return false;
        }
      });
      
      if (validUrls.length === 0) {
        return res.status(400).send('No valid URLs provided');
      }
      
      // Procesăm secțiunile de eliminat
      let sectionsToRemoveArray = [];
      if (sectionsToRemove) {
        sectionsToRemoveArray = sectionsToRemove.split(',')
          .map(section => section.trim())
          .filter(section => section);
        console.log(`Sections to remove: ${JSON.stringify(sectionsToRemoveArray)}`);
      }
      
      job = {
        name: req.query.name || 'Generated PDF',
        urls: validUrls,
        options: {
          pageSize: req.query.pageSize || 'A4',
          landscape: req.query.landscape === 'true',
          sectionsToRemove: sectionsToRemoveArray
        }
      };
      
      console.log('Created job:', JSON.stringify(job));
    } else if (id) {
      // Implementarea pentru folosirea ID-ului unui job existent ar veni aici
      // Deocamdată, doar returnăm o eroare
      return res.status(400).send('Job fetching by ID not implemented yet');
    }
    
    // Verificăm dacă job-ul are cel puțin un URL
    if (!job || !job.urls || job.urls.length === 0) {
      return res.status(400).send('Job has no valid URLs');
    }
    
    // Generăm PDF-ul
    console.log('Calling generatePDF function...');
    const pdfBuffer = await generatePDF(job);
    
    // Verificăm dacă am primit un PDF valid
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return res.status(500).send('Generated PDF is empty');
    }
    
    // Trimitem PDF-ul ca răspuns
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.name || 'generated'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send(`Error generating PDF: ${error.message}`);
  }
});

// Route pentru a accepta cereri direct din UI
app.post('/create-pdf', async (req, res) => {
  try {
    const { name, urls, pageSize, landscape, sectionsToRemove } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
    }
    
    // Creăm job-ul
    const job = {
      name: name || 'Generated PDF',
      urls: urls,
      options: {
        pageSize: pageSize || 'A4',
        landscape: landscape || false,
        sectionsToRemove: sectionsToRemove || []
      }
    };
    
    // Generăm PDF-ul
    const pdfBuffer = await generatePDF(job);
    
    // Trim PDF ca răspuns
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.name || 'generated'}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error creating PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pentru debugging - afișează toate variabilele de mediu (cu mascare pentru chei secrete)
app.get('/debug', (req, res) => {
  // Doar pentru debugging - nu expune asta în producție
  const envVars = {};
  Object.keys(process.env).forEach(key => {
    const value = process.env[key];
    if (key.toLowerCase().includes('key') || 
        key.toLowerCase().includes('secret') || 
        key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('token')) {
      const maskedValue = value ? 
        value.substring(0, 3) + '***' + (value.length > 6 ? value.substring(value.length - 3) : '') : 
        'null';
      envVars[key] = maskedValue;
    } else {
      envVars[key] = value && value.length > 100 ? value.substring(0, 100) + '...' : value;
    }
  });
  
  res.json({
    status: 'Service is running',
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    browserlessApiKey: process.env.BROWSERLESS_API_KEY ? 'Set' : 'Not set',
    environmentVariables: envVars
  });
});

// Tratăm erorile 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

// Tratăm erorile generale
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Server error');
});

// Pornire server
app.listen(PORT, () => {
  console.log(`PDF Generator Service running on port ${PORT}`);
  console.log(`BROWSERLESS_API_KEY is ${process.env.BROWSERLESS_API_KEY ? 'set' : 'NOT SET'}`);
});
