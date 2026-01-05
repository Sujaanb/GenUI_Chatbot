"""
PDF generation service for analysis reports.
Uses reportlab for formatted text and matplotlib for charts.
"""
import io
import re
from datetime import datetime
from typing import Optional, List, Dict
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


class PDFService:
    """Service for generating PDF reports from analysis data."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Set up custom paragraph styles."""
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#1a365d')
        ))
        
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceAfter=12,
            spaceBefore=20,
            textColor=colors.HexColor('#2d3748')
        ))
        
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            textColor=colors.HexColor('#4a5568')
        ))
        
        self.styles.add(ParagraphStyle(
            name='CenteredBody',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6,
            alignment=TA_CENTER,
            textColor=colors.HexColor('#718096')
        ))
    
    def generate_report(self, 
                        filename: Optional[str] = None,
                        analysis_text: str = "") -> bytes:
        """Generate a PDF report from analysis data."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=50,
            leftMargin=50,
            topMargin=50,
            bottomMargin=50
        )
        
        story = []
        
        # Title
        story.append(Paragraph("Analysis Report", self.styles['CustomTitle']))
        story.append(Paragraph(
            f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
            self.styles['CenteredBody']
        ))
        story.append(Spacer(1, 10))
        
        if filename:
            story.append(Paragraph(f"<b>Source:</b> {filename}", self.styles['CenteredBody']))
        
        story.append(Spacer(1, 20))
        
        # Add analysis text
        if analysis_text:
            story.append(Paragraph("Analysis", self.styles['SectionHeader']))
            self._add_formatted_text(story, analysis_text)
        
        # Extract and add charts
        charts = self._extract_all_chart_data(analysis_text)
        if charts:
            story.append(Spacer(1, 20))
            story.append(Paragraph("Visualizations", self.styles['SectionHeader']))
            for chart_data in charts:
                chart_img = self._create_chart_image(chart_data)
                if chart_img:
                    story.append(Spacer(1, 10))
                    story.append(Image(chart_img, width=5*inch, height=3.5*inch))
                    story.append(Paragraph(f"<i>{chart_data.get('title', 'Chart')}</i>", self.styles['CenteredBody']))
                    story.append(Spacer(1, 15))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    def _extract_all_chart_data(self, content: str) -> List[Dict]:
        """Extract all chart data using comprehensive patterns."""
        charts = []
        
        # Extract Issue Type data
        type_data = self._extract_generic_data(content, 
            ['Improvement', 'Bug', 'Change Request', 'Task', 'Feature', 'Epic', 'Story', 'Sub-task'])
        if type_data:
            charts.append({
                'type': 'bar',
                'labels': list(type_data.keys()),
                'values': list(type_data.values()),
                'title': 'Issues by Type'
            })
        
        # Extract Status data
        status_data = self._extract_generic_data(content,
            ['Open', 'In Progress', 'Closed', 'Reopened', 'Resolved', 'Done', 'To Do', 'Blocked', 'In Review'])
        if status_data:
            charts.append({
                'type': 'pie',
                'labels': list(status_data.keys()),
                'values': list(status_data.values()),
                'title': 'Issues by Status'
            })
        
        # Extract Priority data
        priority_data = self._extract_generic_data(content,
            ['Critical', 'High', 'Medium', 'Low', 'Blocker', 'Major', 'Minor', 'Trivial'])
        if priority_data:
            charts.append({
                'type': 'bar_horizontal',
                'labels': list(priority_data.keys()),
                'values': list(priority_data.values()),
                'title': 'Issues by Priority'
            })
        
        return charts
    
    def _extract_generic_data(self, content: str, keywords: List[str]) -> Dict[str, float]:
        """Extract data for given keywords from content."""
        data = {}
        
        for keyword in keywords:
            # Pattern 1: "Keyword: 12" or "- Keyword: 12"
            pattern1 = rf'[-•*]?\s*{re.escape(keyword)}\s*[:\-–]\s*(\d+)'
            matches = re.findall(pattern1, content, re.IGNORECASE)
            if matches:
                data[keyword] = int(matches[0])
                continue
            
            # Pattern 2: "12 Keyword"
            pattern2 = rf'(\d+)\s+{re.escape(keyword)}(?:\s+issues?)?'
            matches = re.findall(pattern2, content, re.IGNORECASE)
            if matches:
                data[keyword] = int(matches[0])
                continue
            
            # Pattern 3: "Keyword (12)"
            pattern3 = rf'{re.escape(keyword)}\s*[\(\[]\s*(\d+)\s*[\)\]]'
            matches = re.findall(pattern3, content, re.IGNORECASE)
            if matches:
                data[keyword] = int(matches[0])
                continue
            
            # Pattern 4: Table cell pattern
            pattern4 = rf'\|\s*{re.escape(keyword)}\s*\|[^|]*?(\d+)\s*\|'
            matches = re.findall(pattern4, content, re.IGNORECASE)
            if matches:
                data[keyword] = int(matches[-1])
                continue
            
            # Pattern 5: "Keyword ... 12"
            pattern5 = rf'{re.escape(keyword)}[^\d]*?(\d+)(?:\s*$|\s*\n)'
            matches = re.findall(pattern5, content, re.IGNORECASE | re.MULTILINE)
            if matches:
                data[keyword] = int(matches[0])
                continue
            
            # Pattern 6: Percentage
            pattern6 = rf'{re.escape(keyword)}\s*(\d+(?:\.\d+)?)\s*%'
            matches = re.findall(pattern6, content, re.IGNORECASE)
            if matches:
                data[keyword] = float(matches[0])
        
        return data
    
    def _add_formatted_text(self, story: list, text: str):
        """Add formatted text to the story."""
        lines = text.split('\n')
        current_list = []
        
        for line in lines:
            if not line.strip():
                if current_list:
                    self._add_list_to_story(story, current_list)
                    current_list = []
                continue
            
            if line.strip().startswith('|'):
                continue
            
            if line.startswith('### '):
                if current_list:
                    self._add_list_to_story(story, current_list)
                    current_list = []
                heading = self._clean_text(line[4:].strip())
                story.append(Spacer(1, 10))
                story.append(Paragraph(f"<b>{heading}</b>", self.styles['CustomBody']))
            elif line.startswith('## '):
                if current_list:
                    self._add_list_to_story(story, current_list)
                    current_list = []
                heading = self._clean_text(line[3:].strip())
                story.append(Paragraph(heading, self.styles['SectionHeader']))
            elif line.strip().startswith(('- ', '* ', '• ')):
                current_list.append(self._clean_text(line.strip()[2:]))
            elif re.match(r'^\d+\.\s', line.strip()):
                match = re.match(r'^\d+\.\s(.+)', line.strip())
                if match:
                    current_list.append(self._clean_text(match.group(1)))
            else:
                if current_list:
                    self._add_list_to_story(story, current_list)
                    current_list = []
                clean_line = self._clean_text(line)
                clean_line = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', clean_line)
                clean_line = re.sub(r'\*(.+?)\*', r'<i>\1</i>', clean_line)
                story.append(Paragraph(clean_line, self.styles['CustomBody']))
        
        if current_list:
            self._add_list_to_story(story, current_list)
    
    def _add_list_to_story(self, story: list, items: List[str]):
        """Add a list to the story."""
        for item in items:
            item = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', item)
            item = re.sub(r'\*(.+?)\*', r'<i>\1</i>', item)
            story.append(Paragraph(f"• {item}", self.styles['CustomBody']))
    
    def _clean_text(self, text: str) -> str:
        """Clean text for PDF rendering."""
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        text = text.replace('&lt;b&gt;', '<b>').replace('&lt;/b&gt;', '</b>')
        text = text.replace('&lt;i&gt;', '<i>').replace('&lt;/i&gt;', '</i>')
        return text
    
    def _create_chart_image(self, chart_data: Dict) -> Optional[io.BytesIO]:
        """Create a chart and return as BytesIO."""
        try:
            color_list = ['#e53e3e', '#ed8936', '#38a169', '#3182ce', '#805ad5', '#d69e2e', '#319795', '#dd6b20']
            
            if chart_data['type'] == 'pie':
                fig, ax = plt.subplots(figsize=(8, 6))
                wedges, texts, autotexts = ax.pie(
                    chart_data['values'],
                    labels=chart_data['labels'],
                    autopct='%1.1f%%',
                    colors=color_list[:len(chart_data['labels'])],
                    startangle=90,
                    explode=[0.03] * len(chart_data['labels']),
                    shadow=True
                )
                for autotext in autotexts:
                    autotext.set_fontsize(10)
                    autotext.set_fontweight('bold')
                ax.set_title(chart_data.get('title', 'Chart'), fontsize=14, fontweight='bold', pad=15)
                
            elif chart_data['type'] == 'bar':
                fig, ax = plt.subplots(figsize=(10, 6))
                x = range(len(chart_data['labels']))
                bars = ax.bar(x, chart_data['values'], color=color_list[:len(chart_data['labels'])], edgecolor='white')
                ax.set_xticks(x)
                ax.set_xticklabels(chart_data['labels'], fontsize=11)
                ax.set_title(chart_data.get('title', 'Chart'), fontsize=14, fontweight='bold', pad=15)
                ax.set_ylabel('Count', fontsize=11)
                for bar, val in zip(bars, chart_data['values']):
                    height = bar.get_height()
                    ax.text(bar.get_x() + bar.get_width()/2., height + 0.3,
                           f'{int(val)}', ha='center', va='bottom', fontsize=11, fontweight='bold')
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                
            elif chart_data['type'] == 'bar_horizontal':
                fig, ax = plt.subplots(figsize=(10, 6))
                y = range(len(chart_data['labels']))
                bars = ax.barh(y, chart_data['values'], color=color_list[:len(chart_data['labels'])], edgecolor='white')
                ax.set_yticks(y)
                ax.set_yticklabels(chart_data['labels'], fontsize=11)
                ax.set_title(chart_data.get('title', 'Chart'), fontsize=14, fontweight='bold', pad=15)
                ax.set_xlabel('Count', fontsize=11)
                for bar, val in zip(bars, chart_data['values']):
                    width = bar.get_width()
                    ax.text(width + 0.3, bar.get_y() + bar.get_height()/2.,
                           f'{int(val)}', ha='left', va='center', fontsize=11, fontweight='bold')
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
            else:
                return None
            
            plt.tight_layout()
            
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', dpi=150, bbox_inches='tight', facecolor='white')
            plt.close(fig)
            img_buffer.seek(0)
            
            return img_buffer
            
        except Exception as e:
            print(f"Chart error: {e}")
            return None
