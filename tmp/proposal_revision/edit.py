from pathlib import Path
from docx import Document
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph

ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'output/documents/The_Apex4_Proposal.docx'
out=ROOT/'output/documents/The_Apex4_Proposal_Updated.docx'
d=Document(source)

def replace(prefix,label,body):
 matches=[p for p in d.paragraphs if p.text.startswith(prefix)]
 assert len(matches)==1,(prefix,len(matches))
 p=matches[0];p.clear();p.add_run(label+' ').bold=True;p.add_run(body);return p

replace('The problem','The problem',
 'Organizers struggle to find suitable sponsors and helpers. Vague requests, scattered conversations and uncertain delivery make programs harder to coordinate. '
 'At the same time, some older adults feel overlooked or disconnected despite having valuable skills and life experience. Without clear opportunities to teach, mentor or help, that knowledge can remain unused.')
replace('Our solution','Our solution',
 'Make each missing resource visible and connect it to a willing person or business. Older adults can contribute alongside younger people, sharing skills and experience through meaningful roles. '
 'We aim to help contributors feel valued, connected and fulfilled while communities gain practical support.')

heading=next(p for p in d.paragraphs if p.text=='What makes our approach distinctive')
heading.text='Why MissingPiece stands out'
old=[]
for p in d.paragraphs:
 if any(p.text.startswith(x) for x in ['Needs first ','People decide ','Trust through delivery ','Example ']):old.append(p)
assert len(old)==4
for p in old:p._element.getparent().remove(p._element)

items=[
 ('More ways to make a difference',
  'A program needs more than money. We connect funding, products, skills, time, equipment and space in one place, so individuals can contribute alongside businesses.'),
 ('Every generation has something to offer',
  'A retired teacher can guide learners; an experienced craftsperson can lead a workshop. Meaningful contributor roles create opportunities to share knowledge, build relationships and feel valued.'),
 ('Relevant sponsors with people in control',
  'AI suggests sponsors with scores and reasons based on program fit. Organizers choose whom to approach and approve helpers; recommendations never become automatic commitments.'),
 ('Promises are separate from delivery',
  'Accepting an offer records a commitment, not receipt. Monetary support is confirmed through successful payment, while organizers record delivered items. Both sides can distinguish promised support from received support.'),
 ('Fewer clashes before the event',
  'Valid contribution schedules and booking checks help prevent overlapping reservations for the same tracked person, equipment or space, making commitments more dependable.'),
 ('One journey with accountability',
  'Account review, moderated conversations, readiness checks and completion reports connect discovery to delivery. Our strength is bringing these steps together around a real community program.')
]
prev=heading
for label,body in items:
 el=OxmlElement('w:p');prev._p.addnext(el);p=Paragraph(el,prev._parent)
 p.add_run(label+'. ').bold=True;p.add_run(body);prev=p

replace('Measure ','Measure',
 'Time to find support, needs fulfilled, actual attendance and repeat collaboration. Include older contributors in the pilot and ask whether participation helps them feel valued and connected. These are intended outcomes, not yet measured results.')
d.save(out)
assert len(d.inline_shapes)==3
assert len(d.tables[0].rows)==5
assert all(not c.text for row in d.tables[0].rows[1:] for c in row.cells)
print(out)
