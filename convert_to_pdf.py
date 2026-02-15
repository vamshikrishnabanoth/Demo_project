"""
Convert Markdown documentation to PDF using markdown and reportlab
"""
import sys
import subprocess
import re

# Check if required packages are installed
try:
    import markdown
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER
except ImportError:
    print("Installing required packages...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "markdown", "reportlab"])
    import markdown
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Preformatted
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT, TA_CENTER

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from io import BytesIO
from html.parser import HTMLParser

class HTMLToPDF(HTMLParser):
    def __init__(self):
        super().__init__()
        self.story = []
        self.styles = getSampleStyleSheet()
        self._setup_styles()
        self.current_text = []
        self.in_code = False
        self.in_pre = False
        self.in_table = False
        self.table_data = []
        self.current_row = []
        self.heading_level = 0
        
    def _setup_styles(self):
        # Custom styles
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2563eb'),
            spaceAfter=30,
            spaceBefore=20
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomHeading1',
            parent=self.styles['Heading1'],
            fontSize=18,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=12,
            spaceBefore=20
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomHeading2',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1e3a8a'),
            spaceAfter=10,
            spaceBefore=15
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomCode',
            parent=self.styles['Code'],
            fontSize=9,
            leftIndent=20,
            backgroundColor=colors.HexColor('#f1f5f9'),
            textColor=colors.HexColor('#dc2626')
        ))
    
    def handle_starttag(self, tag, attrs):
        if tag == 'h1':
            self.heading_level = 1
        elif tag == 'h2':
            self.heading_level = 2
        elif tag == 'h3':
            self.heading_level = 3
        elif tag == 'code':
            self.in_code = True
        elif tag == 'pre':
            self.in_pre = True
        elif tag == 'table':
            self.in_table = True
            self.table_data = []
        elif tag == 'tr':
            self.current_row = []
        elif tag == 'br':
            self.current_text.append('<br/>')
    
    def handle_endtag(self, tag):
        text = ''.join(self.current_text).strip()
        
        if tag in ['h1', 'h2', 'h3'] and text:
            if self.heading_level == 1:
                if len(self.story) > 0:
                    self.story.append(PageBreak())
                self.story.append(Paragraph(text, self.styles['CustomTitle']))
            elif self.heading_level == 2:
                self.story.append(Paragraph(text, self.styles['CustomHeading1']))
            elif self.heading_level == 3:
                self.story.append(Paragraph(text, self.styles['CustomHeading2']))
            self.story.append(Spacer(1, 0.2*inch))
            self.current_text = []
            self.heading_level = 0
            
        elif tag == 'p' and text and not self.in_table:
            self.story.append(Paragraph(text, self.styles['BodyText']))
            self.story.append(Spacer(1, 0.1*inch))
            self.current_text = []
            
        elif tag == 'code':
            self.in_code = False
            
        elif tag == 'pre' and text:
            # Code block
            self.story.append(Preformatted(text, self.styles['CustomCode']))
            self.story.append(Spacer(1, 0.15*inch))
            self.current_text = []
            self.in_pre = False
            
        elif tag == 'li' and text:
            self.story.append(Paragraph(f"• {text}", self.styles['BodyText']))
            self.current_text = []
            
        elif tag == 'td' or tag == 'th':
            self.current_row.append(text)
            self.current_text = []
            
        elif tag == 'tr':
            if self.current_row:
                self.table_data.append(self.current_row)
            self.current_row = []
            
        elif tag == 'table':
            if self.table_data:
                t = Table(self.table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]))
                self.story.append(t)
                self.story.append(Spacer(1, 0.2*inch))
            self.in_table = False
            self.table_data = []
    
    def handle_data(self, data):
        if data.strip():
            self.current_text.append(data)

def convert_md_to_pdf(md_file, pdf_file):
    """Convert markdown file to PDF"""
    
    print(f"Reading {md_file}...")
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Remove mermaid diagrams
    md_content = re.sub(r'```mermaid.*?```', '[Diagram - see markdown version]', md_content, flags=re.DOTALL)
    
    print("Converting markdown to HTML...")
    html_content = markdown.markdown(
        md_content,
        extensions=['extra', 'codehilite', 'tables']
    )
    
    print("Creating PDF...")
    doc = SimpleDocTemplate(
        pdf_file,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=18
    )
    
    # Parse HTML and build story
    parser = HTMLToPDF()
    parser.feed(html_content)
    
    # Build PDF
    doc.build(parser.story)
    print(f"PDF created successfully: {pdf_file}")

if __name__ == "__main__":
    md_file = r"c:\Users\vamsh\OneDrive\Documents\Demo_project\PROJECT_DOCUMENTATION.md"
    pdf_file = r"c:\Users\vamsh\OneDrive\Documents\Demo_project\PROJECT_DOCUMENTATION.pdf"
    
    try:
        convert_md_to_pdf(md_file, pdf_file)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
