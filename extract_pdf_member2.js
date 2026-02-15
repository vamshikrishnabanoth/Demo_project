const fs = require('fs');
const pdfParse = require('pdf-parse');

const dataBuffer = fs.readFileSync('Member2_Quiz_AI_Integration_Guide.pdf');

pdfParse(dataBuffer).then(data => {
    fs.writeFileSync('member2_guide_content.txt', data.text);
    console.log('Content saved to member2_guide_content.txt');
}).catch(err => {
    console.error('Error:', err);
});
