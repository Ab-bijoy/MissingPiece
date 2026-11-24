from pathlib import Path
from PIL import Image
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT=Path(__file__).resolve().parents[2];TMP=Path(__file__).parent
OUT=ROOT/'output/documents/The_Apex4_Proposal.docx'
def crop(n,bounds,name):
 im=Image.open(TMP/f'source-{n}.png');sx=im.width/595.28;sy=im.height/841.89
 x,y,x2,y2=bounds
 im.crop((round(x*sx),round(y*sy),round(x2*sx),round(y2*sy))).save(TMP/name)
crop(1,(35,421,560,586),'connection.png')
crop(2,(35,182,560,619),'workflow.png')
crop(3,(35,563,560,615),'payment.png')
d=Document();s=d.sections[0]
s.page_width=Inches(8.27);s.page_height=Inches(11.69)
s.top_margin=s.bottom_margin=Inches(.55);s.left_margin=s.right_margin=Inches(.7)
s.footer_distance=Inches(.25)
for nm in ['Normal','Title','Subtitle','Heading 1','Heading 2']:
 st=d.styles[nm];st.font.name='Arial';st.font.color.rgb=RGBColor(0,0,0)
normal=d.styles['Normal'];normal.font.size=Pt(10.3);normal.paragraph_format.space_after=Pt(5);normal.paragraph_format.line_spacing=1.04
for nm,sz in [('Title',28),('Heading 1',16),('Heading 2',12),('Subtitle',12)]:
 st=d.styles[nm];st.font.size=Pt(sz);st.paragraph_format.space_before=Pt(9);st.paragraph_format.space_after=Pt(5)
d.styles['Title'].paragraph_format.space_before=Pt(0)
d.core_properties.title='MissingPiece Proposal'
d.core_properties.author='The_Apex4'

def p(text='',bold=False,size=None):
 q=d.add_paragraph();r=q.add_run(text);r.bold=bold
 if size:r.font.size=Pt(size)
 return q
def rich(label,text):
 q=d.add_paragraph();q.add_run(label+' ').bold=True;q.add_run(text);return q
def image(name,width=6.87):
 q=d.add_paragraph();q.paragraph_format.space_after=Pt(3);q.add_run().add_picture(str(TMP/name),width=Inches(width))
 pic=q._p.xpath('.//wp:docPr')[0];pic.set('descr',{'connection.png':'Two-way exchange among organizers, sponsors, community members and MissingPiece, with admin oversight.','workflow.png':'Register and review, publish needs, community and sponsor pathways, confirm and deliver, then complete and review.','payment.png':'BDT 20,000 program contribution plus BDT 1,000 platform fee, for BDT 21,000 sponsor payment.'}[name])
def table(headers,rows,widths):
 t=d.add_table(rows=1,cols=len(headers));t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for i,w in enumerate(widths):t.columns[i].width=Inches(w)
 pr=t._tbl.tblPr
 for el in list(pr):
  if el.tag in [qn('w:tblW'),qn('w:tblInd')]:pr.remove(el)
 el=OxmlElement('w:tblW');el.set(qn('w:w'),str(round(sum(widths)*1440)));el.set(qn('w:type'),'dxa');pr.append(el)
 for c,v in zip(t.rows[0].cells,headers):c.text=v
 for row in rows:
  rr=t.add_row()
  for c,v in zip(rr.cells,row):c.text=v
 for i,row in enumerate(t.rows):
  trPr=row._tr.get_or_add_trPr();el=OxmlElement('w:cantSplit');trPr.append(el)
  if i==0:trPr.append(OxmlElement('w:tblHeader'))
  for j,cell in enumerate(row.cells):
   cell.width=Inches(widths[j]);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   cp=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
   for side in ['top','left','bottom','right']:
    e=OxmlElement('w:'+side);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');b.append(e)
   cp.append(b)
   if i==0:
    shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'F2F2F2');cp.append(shade)
   for q in cell.paragraphs:
    q.paragraph_format.space_before=Pt(4);q.paragraph_format.space_after=Pt(4)
    for r in q.runs:r.font.size=Pt(9.5);r.bold=i==0
 return t
def hyperlink(label,url):
 q=d.add_paragraph();q.paragraph_format.space_after=Pt(3);q.add_run(label+' ').bold=True
 rid=q.part.relate_to(url,RT.HYPERLINK,is_external=True)
 h=OxmlElement('w:hyperlink');h.set(qn('r:id'),rid);r=OxmlElement('w:r');rp=OxmlElement('w:rPr');col=OxmlElement('w:color');col.set(qn('w:val'),'006C59');rp.append(col);r.append(rp);t=OxmlElement('w:t');t.text=url;r.append(t);h.append(r);q._p.append(h)

p('THE_APEX4  |  TSUNAGU HACKATHON  |  NOVEMBER 2026',True,9)
d.add_paragraph('MissingPiece Proposal','Title')
d.add_paragraph('Connecting people to complete community events','Subtitle')
p('We bring organizers, sponsors and community members together around specific needs, clear commitments and real-world programs.')
p('4 roles   |   6 need types   |   1 journey from discovery through delivery',True,10)
rich('The problem','Organizers struggle to find suitable sponsors and helpers. Vague requests, scattered conversations and uncertain delivery make community programs harder to coordinate.')
rich('Our solution','Make each missing resource visible. Connect it to an interested person or business, agree responsibilities, and track the contribution through approval and delivery.')
d.add_heading('Tsunagu in practice',2);image('connection.png')
d.add_heading('Team members and roles',2)
table(['Member name','Role and contribution'],[('','') for _ in range(4)],[3.1,3.77])
p('',size=2).paragraph_format.space_after=Pt(0)
hyperlink('GitHub repository','https://github.com/Ab-bijoy/MissingPiece')
hyperlink('Live web app','https://main.dzf2edfmr40g0.amplifyapp.com/')
table(['YouTube Unlisted link'],[('',)],[6.87])

d.add_page_break()
d.add_heading('From an idea to a supported event',1)
p('One workflow connects discovery, human decisions, support and delivery. Community users can participate or apply to contribute.')
d.add_heading('The complete workflow',2);image('workflow.png')
d.add_heading('What makes our approach distinctive',2)
rich('Needs first','Money, products, skills, time, equipment and space stay distinct. One accepted offer covers a need.')
rich('People decide','AI gives ranked suggestions and reasons. Organizers choose sponsors and approve helpers.')
rich('Trust through delivery','Account review, schedule checks and moderated discussions support clear commitments and records.')
rich('Example','A digital-skills workshop brings together an NGO, a trainer, a local sponsor and learners. A promise of support is tracked separately from confirmed receipt.')

d.add_page_break()
d.add_heading('What works now and what comes next',1)
p('Current implementation supports the core journey. Real-world adoption and social impact still need pilot evidence.')
d.add_heading('Implementation status',2)
table(['Area','Current functionality'],[
('Accounts and programs','Role-based access, organizer/sponsor review, profiles, templates and program publishing.'),
('Community participation','Joining, cancellation, participant-to-helper switching, applications, approval and withdrawal.'),
('Sponsorship and delivery','Sponsor search and AI recommendations, requests, offers, conversations, bookings and receipts.'),
('Payments and reports','Mock/SSLCommerz checkout integration, payment verification, fee records and completion reports.'),
('Trust and administration','AI checks comments/messages for harm and private details. Hidden text is admin-only; admins manage accounts and records.')],[1.75,5.12])
rich('Current boundaries','Payout and refund transfers are manual, with admin records. A need accepts one winning offer; partial funding is not yet supported. AI advice and moderation require human oversight.')
d.add_heading('A simple sustainability model',2)
p('A 5% fee is added to the sponsorship amount. For BDT 20,000 of program support, the sponsor pays BDT 21,000. The chart shows this illustrative breakdown.')
image('payment.png')
rich('Business channels','University clubs, NGO networks, community referrals and direct sponsor outreach.')
rich('Future revenue','Institutional packages, onboarding services and sponsor reporting, subject to demand validation.')
d.add_heading('Next steps and intended impact',2)
rich('Next','Pilot with a university or NGO; expand templates and languages; explore partial offers and automated settlement.')
rich('Measure','Time to find support, needs fulfilled, actual attendance and repeat collaboration. Target easier access and stronger local trust.')
p('Before submission: fill team names, roles and the Unlisted video link on page 1; confirm the GitHub repository is public.',size=9)

for root in [d._element,d.styles.element]:
 for el in list(root.iter(qn('w:pBdr'))):el.getparent().remove(el)
q=s.footer.paragraphs[0];q.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=q.add_run('The_Apex4  |  MissingPiece  |  ');r.font.size=Pt(8)
fld=OxmlElement('w:fldSimple');fld.set(qn('w:instr'),'PAGE');q._p.append(fld)
d.save(OUT);print(OUT)
