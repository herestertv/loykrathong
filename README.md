# ลอยกระทงออนไลน์กับพี่ยู เดอะเบรน (Digital Loy Krathong)

เว็บแอปลอยกระทงออนไลน์: กรอกชื่อและคำอธิษฐาน → เลือกกระทง → เลือกสถานที่จริงในประเทศไทย → ตรวจสอบ → ปล่อยกระทงลงแม่น้ำ (Canvas animation) → ดูกระทงของทุกคนในหน้า “กระทงบนสายน้ำ”

ไม่มี dependency และไม่ต้อง build (HTML + CSS + JavaScript ล้วน) เปิดได้ทันที และ deploy บน Vercel ได้

## โหมดการทำงาน

| ส่วน | ไม่ได้ตั้งค่า (Demo Mode) | ตั้งค่าแล้ว (Live) |
|---|---|---|
| แผนที่ | แผนที่ SVG ของประเทศไทย, สถานที่ 16 แห่ง (พิกัดโดยประมาณ), ค้นหา/ปักหมุด/ค้นหาที่ใกล้เคียงได้ | Google Maps + Places Autocomplete + Nearby Search |
| ฐานข้อมูล | `localStorage` ในเบราว์เซอร์ (มีตัวอย่าง 4 รายการ ติดป้าย “ตัวอย่าง”) | Supabase (PostgreSQL) |

ตั้งค่าแค่บางส่วนได้ เช่น ใช้ Supabase จริงแต่ยังใช้แผนที่สาธิต สถานะปัจจุบันแสดงที่ footer

## โครงสร้าง

```
index.html            ทุกหน้าจอ (Landing, 4 ขั้นตอน, ฉากลอยกระทง, Gallery)
styles.css            ดีไซน์ responsive, mobile-first, reduced motion
app.js                Router, ฟอร์ม, ตัวเลือกกระทง, แผนที่ (Demo/Google), Store (Local/Supabase), แอนิเมชัน, Gallery
config.js             ค่า config (สร้างจาก env ตอน deploy)
scripts/build-config.mjs  เขียน config.js จาก Environment Variables
supabase/schema.sql   ตาราง, view สาธารณะ, ฟังก์ชันบันทึก (validation, moderation, rate limit)
assets/               ภาพจากไฟล์แนบ (แปลงเป็น WebP) — hero-*.webp คือภาพสไลด์หน้าแรก, host*.webp คือพี่ยู
.env.example          รายชื่อ Environment Variables
vercel.json           ตั้งค่า build และ header
```

## รันบนเครื่อง

```bash
cp .env.example .env        # ใส่ค่าเท่าที่มี (เว้นว่าง = Demo)
export $(grep -v '^#' .env | xargs) && node scripts/build-config.mjs
npx serve -l 3000 .         # หรือ python3 -m http.server 3000
```

## เชื่อม Supabase

1. สร้างโปรเจกต์ที่ supabase.com
2. SQL Editor → วางและรัน `supabase/schema.sql`
3. Project Settings → API → คัดลอก `Project URL` และ `anon public key` ไปใส่ `SUPABASE_URL`, `SUPABASE_ANON_KEY`

สิ่งที่ schema ทำ:
- ตาราง `krathongs` เปิด RLS และไม่มี policy → เบราว์เซอร์อ่าน/เขียนตารางตรงไม่ได้
- บันทึกผ่าน `release_krathong()` เท่านั้น: ตรวจความยาว, กรองคำไม่เหมาะสม/ลิงก์/เบอร์โทร (ส่งเข้าสถานะ `pending_review`), จำกัด 1 ครั้ง/30 วินาที และ 30 ครั้ง/วัน ต่อ IP หรืออุปกรณ์, กันคำอธิษฐานซ้ำใน 24 ชม., `client_id` กันการกดซ้ำ/ส่งซ้ำ
- หน้า Gallery อ่านจาก view `public_krathongs` ซึ่งไม่มีคอลัมน์ชื่อจริง และแสดงเฉพาะรายการที่เลือกเผยแพร่และผ่านการตรวจ
- ตรวจรายการค้าง: `select * from krathongs where status = 'pending_review';` อนุมัติด้วย `update krathongs set status='released' where id='…';`
- เพิ่มคำต้องห้าม: `insert into moderation_words values ('คำ');`

ข้อมูลที่เก็บ: id, ชื่อจริง, ชื่อเล่น, คำอธิษฐาน, ประเภทกระทง, ชื่อสถานที่, Google Place ID, จังหวัด, ที่อยู่, lat, lng, เผยแพร่หรือไม่, สถานะ, เวลาที่ปล่อย (+ hash สำหรับกันสแปม; ไม่เก็บ IP ตรง ๆ)

## เชื่อม Google Maps

1. Google Cloud Console → เปิด **Maps JavaScript API**, **Places API (New)** และ **Geocoding API**
2. สร้าง API key → Application restrictions: **Websites** ใส่โดเมนของคุณ (เช่น `https://your-app.vercel.app/*`) → API restrictions: เลือก 3 API ข้างบน
3. (แนะนำ) Map Management → สร้าง Map ID แบบ JavaScript/Vector → ใส่ `GOOGLE_MAPS_MAP_ID` (ใช้กับ Advanced Markers)
4. ใส่ `GOOGLE_MAPS_API_KEY`

ในโหมด Google: ค้นหาด้วย Place Autocomplete (จำกัดประเทศไทย), แตะ POI บนแผนที่เพื่อเลือก, แตะจุดว่างเพื่อปักหมุด (หาจังหวัดด้วย Geocoder), ปุ่ม “ค้นหาสถานที่ใกล้เคียง” ใช้ Nearby Search รัศมี 8 กม., สถานที่แนะนำจะถูกค้นหาซ้ำด้วย Text Search เพื่อให้ได้พิกัดจริง หากโหลด Google Maps ไม่สำเร็จ ระบบจะสลับไปใช้แผนที่สาธิตเอง

## Deploy บน Vercel

1. push โฟลเดอร์นี้ขึ้น GitHub → Import บน Vercel (Framework Preset: **Other**)
2. ใส่ Environment Variables ตาม `.env.example`
3. Deploy — `vercel.json` จะรัน `node scripts/build-config.mjs` ให้อัตโนมัติ

## หมายเหตุ

- คีย์ Google และ Supabase anon key อยู่ฝั่งเบราว์เซอร์โดยการออกแบบ ความปลอดภัยมาจากการจำกัดโดเมน (Google) และ RLS + ฟังก์ชัน (Supabase) ห้ามใส่ `service_role` key
- ระบบกันสแปมฝั่งเบราว์เซอร์ (cooldown, กันซ้ำ) เป็นชั้นแรก ชั้นที่บังคับใช้จริงคือในฟังก์ชัน SQL
- ภาพ “กระทงดอกไม้สีม่วงและทอง” ปรับสีจากภาพกระทงบัวชมพูที่แนบมา และ “กระทงดอกบัวแบบประณีต” ตัดจากภาพฉากพระจันทร์-ดอกบัว ควรเปลี่ยนเป็นภาพจริงเมื่อมี (`assets/k-*.webp`, ขนาดกว้าง ~640px, พื้นหลังโปร่งใส)
- รายการสถานที่และพิกัดใน `app.js` (`PLACES`) เป็นค่าโดยประมาณสำหรับโหมดสาธิต แก้ไข/เพิ่มได้
