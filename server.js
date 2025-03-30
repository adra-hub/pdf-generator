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
      const urlsArray = urls.split(',');
      job = {
        name: req.query.name || 'Generated PDF',
        urls: urlsArray,
        options: {
          pageSize: req.query.pageSize || 'A4',
          landscape: req.query.landscape === 'true',
          expandAccordions: true
        }
      };
    } else {
      // Altfel, preluăm job-ul din baza de date folosind ID-ul
      // (implementarea depinde de structura ta de date)
      // job = await getJobById(id);
      return res.status(400).send('Job fetching by ID not implemented yet');
    }
    
    // Generăm PDF-ul
    const pdfBuffer = await generatePDF(job);
    
    // Trimitem PDF-ul ca răspuns
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.name || 'generated'}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send(`Error generating PDF: ${error.message}`);
  }
});

// Pornire server
app.listen(PORT, () => {
  console.log(`PDF Generator Service running on port ${PORT}`);
});
