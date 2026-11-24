from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT=Path(__file__).resolve().parents[2]
d=Document(ROOT/'output/documents/The_Apex4_Proposal_Updated.docx')
out=ROOT/'output/documents/The_Apex4_Proposal_Comparison.docx'
names=['Meherose Hossain Tasnia','Aninda Barua Bijoy','Md Dil Mansur Khan','Md Azmine Sadik Rakin']
for row,name in zip(d.tables[0].rows[1:],names):
 row.cells[0].text=name
 for p in row.cells[0].paragraphs:
  p.paragraph_format.space_before=Pt(4);p.paragraph_format.space_after=Pt(4)
  for r in p.runs:r.font.size=Pt(9.5)

h=next(p for p in d.paragraphs if p.text=='Why MissingPiece stands out')
h.text='Why choose MissingPiece over a single purpose model'
prefixes=['More ways to make a difference.','Every generation has something to offer.','Relevant sponsors with people in control.','Promises are separate from delivery.','Fewer clashes before the event.','One journey with accountability.']
for p in list(d.paragraphs):
 if any(p.text.startswith(x) for x in prefixes):p._element.getparent().remove(p._element)
def after(el,text,size=9.5,bold=False):
 x=OxmlElement('w:p');el.addnext(x);p=Paragraph(x,h._parent);r=p.add_run(text);r.font.size=Pt(size);r.bold=bold;p.paragraph_format.space_after=Pt(4);return p
p=after(h._p,'Existing models each solve an important part of the journey. Our advantage is connecting the parts needed to deliver a community program.',9.5)

t=d.add_table(rows=1,cols=2);t.autofit=False
widths=[2.16,4.71]
for i,w in enumerate(widths):t.columns[i].width=Inches(w)
for old in list(t._tbl.tblPr):
 if old.tag in (qn('w:tblW'),qn('w:tblInd')):t._tbl.tblPr.remove(old)
tw=OxmlElement('w:tblW');tw.set(qn('w:w'),'9893');tw.set(qn('w:type'),'dxa');t._tbl.tblPr.append(tw)
for c,v in zip(t.rows[0].cells,['Existing model and core focus','MissingPiece advantage for community events']):c.text=v
rows=[
 ('GoFundMe and Ketto [1,2]\nDonation campaigns and fundraising for causes.',
  'Connects money with products, skills, time, equipment and space in one program. People can contribute practical help even when they cannot donate money.'),
 ('Idealist [3]\nDiscovery of volunteer opportunities and causes.',
  'Links helper applications to organizer approval and scheduled needs, alongside sponsorship, bookings and delivery records. The goal is coordinated delivery after people connect.'),
 ('Eventbrite [4]\nEvent registration, ticketing and attendee check-in.',
  'Focuses on securing the support an event needs: AI sponsor recommendations, resource bookings and promised-versus-received contributions, connected to participant registration.')]
for row in rows:
 rr=t.add_row()
 for c,v in zip(rr.cells,row):c.text=v
for i,row in enumerate(t.rows):
 row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
 for j,cell in enumerate(row.cells):
  cell.width=Inches(widths[j]);pr=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
  for side in ['top','left','bottom','right']:
   e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');b.append(e)
  pr.append(b)
  if i==0:
   sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'F2F2F2');pr.append(sh)
  for q in cell.paragraphs:
   q.paragraph_format.space_before=Pt(3);q.paragraph_format.space_after=Pt(3)
   for r in q.runs:r.font.size=Pt(9);r.bold=i==0
p._p.addnext(t._tbl)
p=after(t._tbl,'Our strongest advantage is the combination. For a program needing funding, a trainer and equipment together, we are designed to be a better fit than a single-purpose workflow. A retired teacher can share experience alongside a business providing funds.',9.5)
p.runs[0].text=''
p.add_run('Our strongest advantage is the combination. ').bold=True
p.add_run('For a program needing funding, a trainer and equipment together, we are designed to be a better fit than a single-purpose workflow. A retired teacher can share experience alongside a business providing funds.')
for r in p.runs:r.font.size=Pt(9.5)
p=after(p._p,'Comparison of documented core workflows, not an exhaustive feature audit or a claim of proven market leadership. Official sources checked 24 November 2026:',7.5)
sources=[('[1] GoFundMe','https://www.gofundme.com/c/questions'),('[2] Ketto','https://www.ketto.org/support/'),('[3] Idealist','https://www.idealist.org/en/find-a-volunteer-opportunity'),('[4] Eventbrite','https://www.eventbrite.com/features/registration/')]
p=after(p._p,'',8)
for label,url in sources:
 rid=p.part.relate_to(url,RT.HYPERLINK,is_external=True);x=OxmlElement('w:hyperlink');x.set(qn('r:id'),rid)
 r=OxmlElement('w:r');pr=OxmlElement('w:rPr');sz=OxmlElement('w:sz');sz.set(qn('w:val'),'16');pr.append(sz);col=OxmlElement('w:color');col.set(qn('w:val'),'006C59');pr.append(col);r.append(pr);tx=OxmlElement('w:t');tx.text=label;r.append(tx);x.append(r);p._p.append(x);p.add_run('   ')

# Slightly reduce the workflow figure to allow a readable comparison within page two.
shape=d.inline_shapes[1];ratio=6.32/6.87;shape.width=round(shape.width*ratio);shape.height=round(shape.height*ratio)
for q in d.paragraphs:
 if q._p.xpath('.//w:drawing'):
  if q._p.xpath('.//wp:docPr')[0].get('descr','').startswith('Register and review'):
   from docx.enum.text import WD_ALIGN_PARAGRAPH
   q.alignment=WD_ALIGN_PARAGRAPH.CENTER
for q in d.paragraphs:
 if q.text.startswith('Before submission:'):
  q.text='Before submission: complete each team member\'s role and the Unlisted video link on page 1; confirm the GitHub repository is public.'
  for r in q.runs:r.font.size=Pt(9)
d.save(out)
assert [r.cells[0].text for r in d.tables[0].rows[1:]]==names
assert all(not r.cells[1].text for r in d.tables[0].rows[1:])
print(out)
