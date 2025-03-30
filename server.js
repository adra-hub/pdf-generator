require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generatePDF } = require('./api/pdf-generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rute
app.get('/', (req, res) => {
  res.send('PDF Generator Service is running');
});

// Ruta pentru generarea PDF
app.get('/generate-pdf', async (req, res) => {
  try {
    const { id, urls } = req.query;
    
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
      
      job = {
        name: req.query.name || 'Generated PDF',
        urls: validUrls,
        options: {
          pageSize: req.query.pageSize || 'A4',
          landscape: req.query.landscape === 'true'
        }
      };
      
      console.log('Created job:', JSON.stringify(job));
    } else if (id) {
      // Dacă avem un ID, încercăm să obținem job-ul din baza de date
      // Această parte poate fi implementată dacă dorești să conectezi la MongoDB
      // și să preiei job-ul din baza de date
      /*
      const { connectToDatabase } = require('./db');
      const { ObjectId } = require('mongodb');
      
      const db = await connectToDatabase();
      const jobsCollection = db.collection('jobs');
      
      try {
        job = await jobsCollection.findOne({ _id: new ObjectId(id) });
      } catch (e) {
        job = await jobsCollection.findOne({ _id: id });
      }
      
      if (!job) {
        return res.status(404).send('Job not found');
      }
      */
      
      // Pentru moment, returnăm o eroare pentru că nu avem implementată această funcționalitate
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
    
    // Verificăm dacă este un PDF valid (începe cu %PDF-)
    const isPdf = pdfBuffer.length > 5 && 
                 pdfBuffer.toString('ascii', 0, 5) === '%PDF-';
                 
    if (!isPdf) {
      console.warn('Warning: Generated content does not appear to be a valid PDF');
      console.log('First 20 bytes:', pdfBuffer.toString('ascii', 0, 20));
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
