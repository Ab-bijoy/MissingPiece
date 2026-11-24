from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/documents/MissingPiece_Three_Minute_Video_Script.docx'
d=Document();s=d.sections[0]
s.page_width=Inches(8.27);s.page_height=Inches(11.69)
s.top_margin=s.bottom_margin=Inches(.65);s.left_margin=s.right_margin=Inches(.75)
for nm in ['Normal','Title','Subtitle','Heading 1','Heading 2']:
 st=d.styles[nm];st.font.name='Arial';st.font.color.rgb=RGBColor(0,0,0)
st=d.styles['Normal'];st.font.size=Pt(10.5);st.paragraph_format.space_after=Pt(4);st.paragraph_format.line_spacing=1.06
for nm,sz in [('Title',24),('Heading 1',15),('Heading 2',11)]:
 st=d.styles[nm];st.font.size=Pt(sz);st.paragraph_format.space_before=Pt(10);st.paragraph_format.space_after=Pt(5)
d.styles['Title'].paragraph_format.space_before=Pt(0)
d.core_properties.title='MissingPiece Three Minute Website Workflow Video Script'
d.core_properties.subject='Role by role narration and screen recording actions with dummy data'
d.core_properties.author='MissingPiece'

def para(t,bold=False,size=None):
 p=d.add_paragraph();r=p.add_run(t);r.bold=bold
 if size:r.font.size=Pt(size)
 return p
def note(t):
 p=para(t,size=9);p.paragraph_format.space_before=Pt(3)
def steps(items):
 for i,t in enumerate(items,1):
  p=para(f'{i}. {t}');p.paragraph_format.space_after=Pt(1);p.paragraph_format.left_indent=Inches(.16);p.paragraph_format.first_line_indent=Inches(-.16)
def table(rows):
 t=d.add_table(rows=1,cols=2);t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 t.columns[0].width=Inches(1.55);t.columns[1].width=Inches(5.2)
 for old in list(t._tbl.tblPr):
  if old.tag in (qn('w:tblW'),qn('w:tblInd')):t._tbl.tblPr.remove(old)
 tw=OxmlElement('w:tblW');tw.set(qn('w:w'),'9720');tw.set(qn('w:type'),'dxa');t._tbl.tblPr.append(tw)
 ti=OxmlElement('w:tblInd');ti.set(qn('w:w'),'0');ti.set(qn('w:type'),'dxa');t._tbl.tblPr.append(ti)
 for c,v in zip(t.rows[0].cells,['Field','Dummy data']):c.text=v
 for a,b in rows:
  row=t.add_row();row.cells[0].text=a;row.cells[1].text=b
 for i,row in enumerate(t.rows):
  trPr=row._tr.get_or_add_trPr();no=OxmlElement('w:cantSplit');trPr.append(no)
  for j,cell in enumerate(row.cells):
   cell.width=Inches(1.55 if j==0 else 5.2)
   cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   pr=cell._tc.get_or_add_tcPr();borders=OxmlElement('w:tcBorders')
   for edge in ['top','left','bottom','right']:
    e=OxmlElement('w:'+edge);e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
   pr.append(borders)
   if i==0:
    sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'F2F2F2');pr.append(sh)
   for p in cell.paragraphs:
    p.paragraph_format.space_after=Pt(4);p.paragraph_format.space_before=Pt(4)
    for r in p.runs:r.font.size=Pt(10);r.bold=i==0
 return t

d.add_paragraph('MissingPiece Website Workflow Video Script','Title')
para('Three minute presentation with dummy data',True,12)
para('Follow one community program through registration, organizer approval, event creation, participation, contribution, sponsorship, payment, completion, and administration. Read only the narration aloud; use the numbered actions to guide your screen recording.')
d.add_heading('Demo data',1)
table([
('Admin','Sara Ahmed'),('Organizer','Rafi Hasan - BrightFuture Community Foundation'),
('Program','Digital Skills for Everyone'),('Description','A beginner-friendly workshop on email, online forms, and smartphone safety.'),
('Date and time','12 December 2026, 2:00-4:00 PM, Dhaka time'),('Venue','Dhanmondi Community Learning Centre'),
('Capacity','20 participants'),('Contributor need','One digital-skills trainer, 2:00-4:00 PM'),
('Funding need','BDT 10,000 for learning materials and event expenses'),('Participant','Rahim Ahmed'),
('Contributor','Nadia Islam - teaching and basic computer training'),('Sponsor','Maya Rahman - GreenByte Technologies'),
('Sponsor interests','Education, digital inclusion, and community development'),('Payment','BDT 10,000 contribution + BDT 500 service fee = BDT 10,500')])
d.add_heading('Before recording',1)
para('Use test accounts you control. All names, organizations, and venues above are fictional. Prepare forms, role-specific browser profiles, and sample applications. Use sandbox checkout and cut typing and loading time. Rehearse the narration against the timestamps; screen actions happen while you speak.')
note('Use a future event date when filming. For the completion clip, prepare a separate past-event test record of the workshop. Do not present the future workshop as already completed.')

scenes=[
('Introduction','0:00-0:10',[
 'Show the homepage and the program title.'
], 'This is MissingPiece. Today, BrightFuture Community Foundation wants to organize Digital Skills for Everyone. Let\'s see how an organizer, participants, a contributor, a sponsor, and an administrator work together.'),
('Registration login and approval','0:10-0:35',[
 'Open Organizer registration as Rafi Hasan.',
 'Enter BrightFuture Community Foundation and show the supporting-document upload.',
 'Briefly show Maya registering GreenByte Technologies as a sponsor.',
 'Log in with the existing admin account, Sara Ahmed.',
 'Review and approve both registration requests.',
 'Show Rafi logging in to the organizer dashboard.'
], 'Rafi registers BrightFuture as an organizer and submits its supporting document. Maya registers GreenByte Technologies as a sponsor. Our administrator, Sara, reviews their details and approves the applications. Rafi and Maya can now log in and access their dashboards. Community members register separately to participate or offer help.'),
('Organizer creates the event','0:35-1:00',[
 'Open Rafi\'s dashboard and select Create program.',
 'Enter Digital Skills for Everyone and the workshop description.',
 'Set 12 December, the venue, and a capacity of 20 participants.',
 'Add a BDT 10,000 funding need.',
 'Add one trainer need with a valid schedule of 2:00-4:00 PM.',
 'Review the program and click Publish.'
], 'Rafi creates Digital Skills for Everyone for December twelfth at the Dhanmondi Community Learning Centre, with twenty participant seats. He adds two needs: ten thousand taka for event expenses and one digital-skills trainer. He sets the trainer\'s schedule from two to four PM, reviews the information, and publishes the program.'),
('Community members join and contribute','1:00-1:30',[
 'Log in as Rahim Ahmed.',
 'Browse the feed and open Digital Skills for Everyone.',
 'Click Join as participant.',
 'Open My contributions and show the cancellation option.',
 'Post the question: Should I bring my own smartphone?',
 'Switch to Nadia Islam\'s account.',
 'Update her skills to Teaching and basic computer training.',
 'Select the trainer need and submit her application.',
 'Show the pending application and its eligible withdrawal option.'
], 'Rahim logs in, finds the workshop, and joins as a participant. He can track his participation or cancel if his plans change. He asks whether he should bring a smartphone. Nadia wants to help instead. She updates her teaching skills and applies for the trainer role. Her application now waits for the organizer\'s decision.'),
('Organizer approves and finds a sponsor','1:30-1:55',[
 'Return to Rafi\'s organizer dashboard.',
 'Open the contributor approval list.',
 'Review Nadia\'s application and click Approve.',
 'Show her updated application status.',
 'Click Find sponsors with AI and show a real recommendation and explanation.',
 'Select GreenByte Technologies if recommended, or find it through sponsor search.',
 'Send GreenByte the BDT 10,000 funding request.'
], 'Rafi reviews Nadia\'s application and approves her as the trainer. Her membership and contribution offer update together. He then requests AI sponsor recommendations. GreenByte\'s education and digital-inclusion interests make it a relevant business to approach. Rafi reviews the available information and sends GreenByte a request for ten thousand taka.'),
('Sponsor makes an offer and pays','1:55-2:25',[
 'Log in as Maya Rahman and briefly show GreenByte\'s profile and interests.',
 'Open Rafi\'s sponsorship request and review the program.',
 'Submit a BDT 10,000 offer.',
 'Send: We would like to support the workshop\'s learning materials.',
 'Switch to Rafi and accept the offer.',
 'Return to Maya and open the payment quote.',
 'Show BDT 10,000 + BDT 500 = BDT 10,500.',
 'Complete sandbox checkout and show the confirmed result.'
], 'Maya logs in as GreenByte\'s sponsor representative and reviews the request. She offers ten thousand taka and messages Rafi about supporting the learning materials. Rafi accepts. Maya then reviews the payment: ten thousand taka in support, plus a five-hundred-taka service fee. She completes sandbox checkout, and the confirmed result appears in the payment records.'),
('Organizer completes the program','2:25-2:40',[
 'Open a prepared past-event test version of the workshop.',
 'Review the trainer and funding support, and show resource receipts where applicable.',
 'Mark the program complete and open its report.'
], 'After the workshop takes place, Rafi reviews the support received and completes the program. The report brings together the contributions, helping BrightFuture and GreenByte review what they supported and plan future collaboration.'),
('Admin moderation and management','2:40-2:55',[
 'Show a prepared test comment: Contact me at participant@example.com.',
 'Show its hidden-content notice.',
 'Switch to Sara\'s admin dashboard and open the hidden-comment review.',
 'Briefly show account, template, payment, payout, and refund management.'
], 'Sara manages accounts, templates, and financial records. Comments and messages are checked for harmful content and private contact details. This test email-sharing comment is hidden from ordinary users. Only an administrator can review the hidden content and decide whether to restore or delete it.'),
('Closing','2:55-3:00',[
 'Return to the MissingPiece logo or homepage.'
], 'MissingPiece connects people, resources, and purpose to make community programs happen.')]

for i,(title,timing,actions,voice) in enumerate(scenes,1):
 if i in (1,4,6):d.add_page_break()
 d.add_heading(f'{i} {title}',1)
 para(timing,True,10)
 para('Screen actions',True)
 steps(actions)
 para('Narration',True)
 para(voice)
 if i==2:note('Admin accounts are assigned separately. Use an existing admin account for this scene.')
 if i==5:note('Show the actual AI result. Do not invent a recommendation score or imply that GreenByte appeared if it did not.')
 if i==7:note('This clip represents the period after the event. Use the prepared past-event record.')

for root in (d._element,d.styles.element):
 for border in list(root.iter(qn('w:pBdr'))):border.getparent().remove(border)
d.save(OUT)
words=sum(len(v.split()) for _,_,_,v in scenes)
print('Saved',OUT)
print('Narration words',words,'Words per minute over 3 minutes',round(words/3))
