from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT=Path(__file__).resolve().parents[2]; TMP=Path(__file__).parent
d=Document(ROOT/'output/documents/The_Apex4_Proposal_Comparison.docx')
out=ROOT/'output/documents/The_Apex4_Proposal_Times_New_Roman.docx'
green='#006C59'; blue='#236994'; ink='#163541'; pale='#EDF6F2'
def font(size,b=False):return ImageFont.truetype('C:/Windows/Fonts/'+('timesbd.ttf' if b else 'times.ttf'),size)
def canvas(h):
 global im,dr
 im=Image.new('RGB',(1400,h),'white');dr=ImageDraw.Draw(im)
def words(text,x,y,width,size=28,bold=False,fill=ink):
 f=font(size,bold);lines=[];line=''
 for word in text.split():
  trial=(line+' '+word).strip()
  if dr.textlength(trial,font=f)>width and line:lines.append(line);line=word
  else:line=trial
 lines.append(line)
 for s in lines:dr.text((x,y),s,font=f,fill=fill);y+=size+6
 return y
def box(x,y,w,h,title,text,fill=pale,size=28):
 dr.rounded_rectangle((x,y,x+w,y+h),18,fill=fill,outline='#B8CFC5',width=2)
 yy=words(title,x+18,y+12,w-36,31,True,green)
 words(text,x+18,yy+5,w-36,size)
def arrow(x,y,x2,y2,c=green):
 import math
 dr.line((x,y,x2,y2),fill=c,width=4);a=math.atan2(y2-y,x2-x)
 dr.polygon([(x2,y2),(x2-15*math.cos(a-.5),y2-15*math.sin(a-.5)),(x2-15*math.cos(a+.5),y2-15*math.sin(a+.5))],fill=c)

canvas(440)
box(0,0,435,180,'ORGANIZER','Offers: ideas and leadership. Gains: resources and helpers.')
box(965,0,435,180,'SPONSOR','Offers: funding and resources. Gains: community connections and reports.')
box(0,260,435,180,'COMMUNITY','Offers: skills, time and participation. Gains: learning, relationships and purpose.')
box(965,260,435,180,'ADMIN','Reviews accounts and hidden content; supports accountability.')
box(475,110,450,220,'MISSINGPIECE','Shared needs + agreed contributions = real community programs.',fill='#DCEFE7',size=32)
arrow(435,85,475,155);arrow(475,195,435,145,blue)
arrow(965,85,925,155);arrow(925,195,965,145,blue)
arrow(435,320,475,245);arrow(475,285,435,375,blue)
arrow(965,330,925,285)
words('Green: contribution / oversight     Blue: value returned',475,365,450,24)
im.save(TMP/'connection.png')

canvas(690)
box(0,0,660,130,'1. REGISTER AND REVIEW','Choose a role; admins review organizer and sponsor accounts.')
box(740,0,660,130,'2. PUBLISH A PROGRAM','Organizer sets needs, date, venue, capacity and valid contributor schedules.')
arrow(660,65,740,65)
arrow(1070,130,1070,175)
dr.line((330,153,1070,153),fill=green,width=4);arrow(330,153,330,175)
box(0,175,660,220,'3A. COMMUNITY TAKES PART','Participants join or cancel. Helpers apply for a scheduled need; the organizer approves or rejects. A participant can switch to helping.')
box(740,175,660,220,'3B. SPONSORS OFFER SUPPORT','AI suggests relevant sponsors with reasons. Organizers approach sponsors; sponsors offer funds or resources. People accept or decline.')
arrow(330,395,330,430);arrow(1070,395,1070,430)
box(0,430,1400,120,'4. CONFIRM SUPPORT AND DELIVER','Check bookings, verify sponsor payment and record delivered resources. An accepted promise is kept separate from confirmed receipt.')
arrow(700,550,700,585)
box(0,585,1400,105,'5. COMPLETE AND REVIEW','Run the community program, record completion and review the support received.')
im.save(TMP/'workflow.png')

canvas(140)
dr.rounded_rectangle((0,0,1110,76),12,fill=green)
dr.rounded_rectangle((1120,0,1400,76),12,fill='#E7B75C')
words('BDT 20,000  |  Program support',25,17,1060,33,True,'white')
words('BDT 1,000 fee',1135,19,250,30,True)
words('Illustrative total paid: BDT 21,000. The 5% fee is added to support; graphic is not to scale.',0,90,1400,28)
im.save(TMP/'payment.png')

for shape,name,width in zip(d.inline_shapes,['connection','workflow','payment'],[6.87,6.87,6.87]):
 rid=shape._inline.graphic.graphicData.pic.blipFill.blip.embed
 d.part.related_parts[rid]._blob=(TMP/(name+'.png')).read_bytes()
 shape.width=Inches(width)
 with Image.open(TMP/(name+'.png')) as src:shape.height=round(shape.width*src.height/src.width)

h=next(p for p in d.paragraphs if p.text.startswith('Why choose MissingPiece'))
h.text='Why choose MissingPiece? A focused comparison'
p=next(p for p in d.paragraphs if p.text.startswith('Existing models each'))
p.text='These platforms already support valuable social-impact work. MissingPiece focuses on completing local programs by connecting each missing resource to a clear commitment.'
t=d.tables[2]
for row in list(t.rows)[1:]:t._tbl.remove(row._tr)
t.rows[0].cells[0].text='Platform and established focus'
t.rows[0].cells[1].text='Our focus: the complete local program'
rows=[
('GivePulse [1]\nCommunity engagement, volunteer/event management and giving.', 'We organize six explicit need types around one program, linking sponsor offers, helper decisions and promised-versus-received support.'),
('Benevity [2]\nCorporate giving, grants and employee volunteering.', 'Our starting point is the community organizer: local businesses and individual contributors respond to the same program’s resource needs.'),
('Goodera [3]\nManaged employee volunteering with nonprofit partners and impact reporting.', 'Organizers directly coordinate public participants, helpers and sponsor resources, keeping the program’s decisions and commitments in one workflow.'),
('POINT [4]\nVolunteer recruitment, scheduling, communication and reporting.', 'Alongside participation, we connect sponsor recommendations, monetary support, equipment or space bookings and delivery records to specific needs.'),
('Catchafire [5]\nSkills-based volunteering and pro bono support for nonprofit capacity.', 'A trainer’s skills can sit beside funding, products, time, equipment and space for the same event, with schedules and organizer approval.')]
for vals in rows:
 row=t.add_row()
 for c,v in zip(row.cells,vals):c.text=v
for i,row in enumerate(t.rows):
 row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
 for j,c in enumerate(row.cells):
  c.width=Inches([2.16,4.71][j])
  for p in c.paragraphs:
   p.paragraph_format.space_before=Pt(3);p.paragraph_format.space_after=Pt(3)
   for r in p.runs:r.font.size=Pt(9.5);r.bold=i==0
p=next(p for p in d.paragraphs if p.text.startswith('Our strongest advantage'))
p.text='Our strongest fit: a local program needing several kinds of support together. A retired teacher, a student helper and a business sponsor can each fill a different missing piece—while organizers track commitments through delivery.'
for r in p.runs:r.font.size=Pt(9.5)
p=next(p for p in d.paragraphs if p.text.startswith('Comparison of documented'))
p.text='Positioning based on official product descriptions, checked 24 November 2026. Features overlap; this is not an exhaustive audit or a claim of proven superiority.'
for r in p.runs:r.font.size=Pt(7.5)
p=next(p for p in d.paragraphs if '[1] GoFundMe' in p.text)
p.clear()
sources=[('GivePulse','https://learn.givepulse.com/pricing'),('Benevity','https://benevity.com/nonprofits'),('Goodera','https://www.goodera.com/en-gb/nonprofits'),('POINT','https://pointapp.org/pricing/'),('Catchafire','https://www.catchafire.org/')]
for i,(label,url) in enumerate(sources,1):
 rid=p.part.relate_to(url,RT.HYPERLINK,is_external=True);link=OxmlElement('w:hyperlink');link.set(qn('r:id'),rid)
 r=OxmlElement('w:r');pr=OxmlElement('w:rPr');sz=OxmlElement('w:sz');sz.set(qn('w:val'),'16');pr.append(sz);r.append(pr)
 tx=OxmlElement('w:t');tx.text=f'[{i}] {label}';r.append(tx);link.append(r);p._p.append(link);p.add_run('   ')

# Apply Times New Roman explicitly to native text, hyperlinks, styles and footer.
for root in [d._element,d.styles.element]+[s.footer._element for s in d.sections]:
 for pr in list(root.iter(qn('w:rPr'))):
  fonts=pr.find(qn('w:rFonts'))
  if fonts is None:fonts=OxmlElement('w:rFonts');pr.insert(0,fonts)
  for key in list(fonts.attrib):del fonts.attrib[key]
  for key in ['ascii','hAnsi','cs','eastAsia']:fonts.set(qn('w:'+key),'Times New Roman')
 for r in list(root.iter(qn('w:r'))):
  pr=r.find(qn('w:rPr'))
  if pr is None:pr=OxmlElement('w:rPr');r.insert(0,pr)
  if pr.find(qn('w:rFonts')) is None:
   fonts=OxmlElement('w:rFonts')
   for key in ['ascii','hAnsi','cs','eastAsia']:fonts.set(qn('w:'+key),'Times New Roman')
   pr.insert(0,fonts)
 for border in list(root.iter(qn('w:pBdr'))):border.getparent().remove(border)
d.styles['Normal'].font.name='Times New Roman'
d.save(out)
print(out)
