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
    } else {
      // Implementarea pentru job-ul din baza de date
      return res.status(400).send('Job fetching by ID not implemented yet');
    }
    
    // Generăm PDF-ul
    console.log('Calling generatePDF function...');
    const pdfBuffer = await generatePDF(job);
    
    // Trimitem PDF-ul ca răspuns
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.name || 'generated'}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send(`Error generating PDF: ${error.message}`);
  }
});
