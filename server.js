require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pdfGenerator = require('./api/pdf-generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rute
app.get('/', function(req, res) {
  res.send('PDF Generator Service is running. Use /generate-pdf endpoint to generate PDFs.');
});

// Ruta pentru generarea PDF
app.get('/generate-pdf', function(req, res) {
  try {
    const id = req.query.id;
    const urls = req.query.urls;
    const sectionsToRemove = req.query.sectionsToRemove;
    
    if (!id && !urls) {
      return res.status(400).send('Missing job ID or URLs');
    }
    
    // Dacă ai URLs în query string, le folosim direct
    let job;
    if (urls) {
      // Convertim string-ul de URL-uri separate prin virgulă într-un array
      const urlsArray = urls.split(',').map(function(url) {
        return url.trim();
      }).filter(function(url) {
        return url;
      });
      
      console.log('Processing URLs: ' + JSON.stringify(urlsArray));
      
      // Verificăm dacă avem cel puțin un URL valid
      if (urlsArray.length === 0) {
        return res.status(400).send('No valid URLs provided');
      }
      
      // Validăm URL-urile pentru a ne asigura că sunt formate corect
      const validUrls = urlsArray.filter(function(url) {
        try {
          new URL(url);
          return true;
        } catch (e) {
          console.warn('Invalid URL: ' + url);
          return false;
        }
      });
      
      if (validUrls.length === 0) {
        return res.status(400).send('No valid URLs provided');
      }
      
      // Procesăm secțiunile de eliminat
      let sectionsToRemoveArray = [];
      if (sectionsToRemove) {
        sectionsToRemoveArray = sectionsToRemove.split(',').map(function(section) {
          return section.trim();
        }).filter(function(section) {
          return section;
        });
        console.log('Sections to remove: ' + JSON.stringify(sectionsToRemoveArray));
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
      
      console.log('Created job: ' + JSON.stringify(job));
    } else if (id) {
      // Implementarea pentru folosirea ID-ului unui job existent ar veni aici
      return res.status(400).send('Job fetching by ID not implemented yet');
    }
    
    // Verificăm dacă job-ul are cel puțin un URL
    if (!job || !job.urls || job.urls.length === 0) {
      return res.status(400).send('Job has no valid URLs');
    }
    
    // Generăm PDF-ul
    console.log('Calling generatePDF function...');
    pdfGenerator.generatePDF(job).then(function(pdfBuffer) {
      // Verificăm dacă am primit un PDF valid
      if (!pdfBuffer || pdfBuffer.length === 0) {
        return res.status(500).send('Generated PDF is empty');
      }
      
      // Trimitem PDF-ul ca răspuns
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + (job.name || 'generated') + '.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    }).catch(function(error) {
      console.error('Error generating PDF:', error);
      res.status(500).send('Error generating PDF: ' + error.message);
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send('Error generating PDF: ' + error.message);
  }
});

// Restul codului rămâne neschimbat...

// Pornire server
app.listen(PORT, function() {
  console.log('PDF Generator Service running on port ' + PORT);
  console.log('BROWSERLESS_API_KEY is ' + (process.env.BROWSERLESS_API_KEY ? 'set' : 'NOT SET'));
});
