# สร้าง src/theme/themes.css + themes.js จากตารางธีม
import json,sys
out=sys.argv[1]
T=[
 dict(id='snt',n='KruScan น้ำเงินหมึก (ค่าเริ่มต้น)',side='#0c1833',sideFg='#dae4f5',sideOn='#22345a',sideOnFg='#ffffff',accent='#f6a92e',accentFg='#0c1833',page='#f3f5f9',ink='#151a27',cta='#2b4f99',ctaFg='#ffffff',th='#eef3fb',thFg='#152851',title='#152851',titleFg='#ffffff',primary='#2b4f99',logo='#ffffff'),
 dict(id='navy',n='กรมท่าสุขุม',side='#16233f',sideFg='#c9d3e8',sideOn='#2a3c63',sideOnFg='#fff',accent='#f2b544',accentFg='#16233f',page='#f4f6fa',ink='#16233f',cta='#f2b544',ctaFg='#1d1a12',th='#e6ecf7',thFg='#16233f',title='#16233f',titleFg='#fff',primary='#24407a',logo='#ffffff'),
 dict(id='kram',n='ครามโรงเรียน',side='#1f2a5c',sideFg='#cdd4f0',sideOn='#f2c14e',sideOnFg='#1f2a5c',accent='#f2c14e',accentFg='#1f2a5c',page='#f5f6fb',ink='#1f2a5c',cta='#3346a8',ctaFg='#fff',th='#1f2a5c',thFg='#fff',title='#1f2a5c',titleFg='#fff',primary='#3346a8',logo='#ffffff'),
 dict(id='green',n='เขียวหมึกครู',side='#163a33',sideFg='#c3dcd5',sideOn='#25564c',sideOnFg='#fff',accent='#e9a23b',accentFg='#163a33',page='#f3f6f5',ink='#163a33',cta='#e9a23b',ctaFg='#1f1606',th='#e2efeb',thFg='#163a33',title='#163a33',titleFg='#fff',primary='#1f6b5c',logo='#ffffff'),
 dict(id='sky',n='ฟ้าสว่างมินิมอล',side='#ffffff',sideFg='#4a5568',sideOn='#e8f0ff',sideOnFg='#1e4fd8',accent='#1e4fd8',accentFg='#ffffff',page='#f6f8fb',ink='#1a2233',cta='#1e4fd8',ctaFg='#fff',th='#f1f4f9',thFg='#334155',title='#1a2a4a',titleFg='#fff',primary='#1e4fd8',logo='#1e4fd8'),
 dict(id='teal',n='น้ำทะเลเทอร์ควอยซ์',side='#0f3d4a',sideFg='#bfe0e6',sideOn='#16596b',sideOnFg='#fff',accent='#ffc857',accentFg='#0f3d4a',page='#f2f7f8',ink='#0f3d4a',cta='#0e8a9a',ctaFg='#fff',th='#dff0f2',thFg='#0f3d4a',title='#0f3d4a',titleFg='#fff',primary='#0e7c8b',logo='#ffffff'),
 dict(id='maroon',n='แดงเลือดหมู',side='#4a1a22',sideFg='#ecc9ce',sideOn='#6b2733',sideOnFg='#fff',accent='#d9a441',accentFg='#4a1a22',page='#faf6f5',ink='#4a1a22',cta='#8c2f3d',ctaFg='#fff',th='#f6e9ea',thFg='#4a1a22',title='#4a1a22',titleFg='#fff',primary='#8c2f3d',logo='#ffffff'),
 dict(id='classic',n='น้ำเงิน-ขาว คลาสสิก',side='#0f2557',sideFg='#c7d2ec',sideOn='#ffffff',sideOnFg='#0f2557',accent='#ffb703',accentFg='#0f2557',page='#f4f6fb',ink='#0f2557',cta='#0f2557',ctaFg='#fff',th='#0f2557',thFg='#fff',title='#0f2557',titleFg='#fff',primary='#1d4ed8',logo='#ffffff'),
 dict(id='pastel',n='พาสเทลนุ่ม',side='#eef2fb',sideFg='#4b5a78',sideOn='#d8e2fa',sideOnFg='#22345e',accent='#7aa2f7',accentFg='#16233f',page='#fafbfe',ink='#22345e',cta='#3f5fc8',ctaFg='#fff',th='#eaf0fc',thFg='#22345e',title='#3a4f86',titleFg='#fff',primary='#3f5fc8',logo='#3a4f86'),
 dict(id='sakura',n='ชมพูซากุระ',side='#fdf0f4',sideFg='#7a4a5c',sideOn='#f7d6e2',sideOnFg='#8e2c55',accent='#e86a92',accentFg='#16233f',page='#fffafc',ink='#5a2440',cta='#b8345f',ctaFg='#fff',th='#fbe6ee',thFg='#5a2440',title='#8e2c55',titleFg='#fff',primary='#b8345f',logo='#8e2c55'),
 dict(id='lavender',n='ลาเวนเดอร์',side='#f3f0fb',sideFg='#5b5178',sideOn='#e2dbf7',sideOnFg='#46348f',accent='#7455d0',accentFg='#ffffff',page='#fbfaff',ink='#33275e',cta='#6d55c9',ctaFg='#fff',th='#ece7fa',thFg='#33275e',title='#46348f',titleFg='#fff',primary='#6d55c9',logo='#46348f'),
 dict(id='mint',n='มิ้นต์สดใส',side='#effaf6',sideFg='#3f6b5c',sideOn='#d3f1e5',sideOnFg='#11694d',accent='#2bb38a',accentFg='#0b2e25',page='#f9fdfb',ink='#14483a',cta='#0f7a5a',ctaFg='#fff',th='#dff5ec',thFg='#14483a',title='#11694d',titleFg='#fff',primary='#0f7a5a',logo='#11694d'),
 dict(id='night',n='โหมดกลางคืน',dark=True,side='#0f131b',sideFg='#aab3c5',sideOn='#1f2736',sideOnFg='#fff',accent='#7aa2f7',accentFg='#0f131b',page='#161b25',ink='#e6eaf2',cta='#7aa2f7',ctaFg='#0f131b',th='#1f2736',thFg='#e6eaf2',title='#0b0e14',titleFg='#fff',primary='#4f7be0',logo='#ffffff'),
]
def rgb(h):
  h=h.lstrip('#'); h=''.join(c*2 for c in h) if len(h)==3 else h
  return [int(h[i:i+2],16) for i in (0,2,4)]
mix=lambda a,b,t:[round(x+(y-x)*t) for x,y in zip(a,b)]
ch=lambda c:' '.join(map(str,c))
SNT={50:'#eef3fb',100:'#dae4f5',200:'#b7cbec',300:'#8aaadd',400:'#5c84ca',500:'#3b64b3',600:'#2b4f99',700:'#22407f',800:'#1b3366',900:'#152851',950:'#0c1833'}
def scale(t):
  if t['id']=='snt': return {k:rgb(v) for k,v in SNT.items()}
  p=rgb(t['primary']);W=[255,255,255];K=[8,10,20]
  if t.get('dark'):  # กลับด้าน: เลขน้อย = พื้นเข้ม
    bg=rgb('#1c2230');s={50:mix(bg,p,.12),100:mix(bg,p,.22),200:mix(bg,p,.4),300:mix(bg,p,.6),400:mix(p,W,.35),500:mix(p,W,.2),600:mix(p,K,.28),700:mix(p,W,.15),800:mix(p,W,.3),900:mix(p,W,.55),950:mix(p,W,.7)}
    return s
  return {50:mix(p,W,.93),100:mix(p,W,.85),200:mix(p,W,.7),300:mix(p,W,.5),400:mix(p,W,.3),500:mix(p,W,.13),600:p,700:mix(p,K,.15),800:mix(p,K,.3),900:mix(p,K,.45),950:mix(p,K,.6)}
roles=dict(side='side',sideFg='side-fg',sideOn='side-on',sideOnFg='side-on-fg',accent='accent',accentFg='accent-fg',page='page',ink='ink',cta='cta',ctaFg='cta-fg',th='th',thFg='th-fg',title='title',titleFg='title-fg',primary='primary',logo='side-logo')
css=['/* สร้างอัตโนมัติจาก genthemes.py — แก้ที่ตารางธีมแล้วรันใหม่ (ดู BRAND.md) */']
for i,t in enumerate(T):
  sel=':root, [data-color-theme="snt"]' if i==0 else f'[data-color-theme="{t["id"]}"]'
  L=[f'  --{v}: {ch(rgb(t[k]))};' for k,v in roles.items()]
  L+= [f'  --brand-{k}: {ch(c)};' for k,c in scale(t).items()]
  L.append(f'  --primary-fg: 255 255 255;')
  if t.get('dark'): L+=['  --login-from: 28 42 74;','  --login-to: 11 14 20;','  --card: 28 34 48;']
  else: L+=[f'  --login-from: {ch(scale(t)[700])};',f'  --login-to: {ch(scale(t)[950])};','  --card: 255 255 255;']
  L.append(f'  --brand-link: {ch(mix(rgb(t["primary"]),[255,255,255],.35) if t.get("dark") else scale(t)[600])};')
  if t.get('dark'): L.append('  color-scheme: dark;')
  css.append(sel+' {\n'+'\n'.join(L)+'\n}')
open(f'{out}/themes.css','w').write('\n'.join(css)+'\n')
js=[{'id':t['id'],'name':t['n'],'swatches':[t['side'],t['primary'],t['th'],t['accent'],t['page']],'dark':bool(t.get('dark'))} for t in T]
open(f'{out}/themes.js','w').write('// สร้างอัตโนมัติจาก genthemes.py\nconst THEMES = '+json.dumps(js,ensure_ascii=False,indent=1)+';\nexport default THEMES;\nexport const DEFAULT_THEME = \'snt\';\n')
