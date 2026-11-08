-- =====================================================================
-- إيجاد للمفقودات — بيانات تجريبية (بلاغات فاقد وعاثر)
--
-- شغّله في Supabase: SQL Editor → New query → الصق الملف → Run
-- يُشغَّل بعد 001_schema.sql. آمن لو شغّلته أكثر من مرة: يحذف البيانات
-- التجريبية السابقة (المعلَّمة بـ "seed":"demo") ويعيد إضافتها.
--
-- مستخدمون تجريبيون (كلمة المرور لهم كلهم: Demo12345!):
--   0500000101 سارة الحربي    0500000102 فهد الجهني
--   0500000103 نورة المطيري   0500000104 عبدالله الرفاعي
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) التصنيفات (نفس الموجودة في الموقع؛ لا تتكرر لو موجودة)
-- ---------------------------------------------------------------------
insert into public.categories (name_ar, name_en, is_active, sort_order) values
    ('الهواتف', 'Phones', 1, 1),
    ('المحافظ', 'Wallets', 1, 2),
    ('المفاتيح', 'Keys', 1, 3),
    ('المستندات', 'Documents', 1, 4),
    ('الحقائب', 'Bags', 1, 5),
    ('الإلكترونيات', 'Electronics', 1, 6),
    ('الساعات', 'Watches', 1, 7),
    ('النظارات', 'Glasses', 1, 8),
    ('المجوهرات', 'Jewelry', 1, 9),
    ('الحيوانات', 'Pets', 1, 10),
    ('الملابس', 'Clothing', 1, 11),
    ('أخرى', 'Other', 1, 99),
    ('أغراض شخصية', 'Personal Items', 1, 20),
    ('رياضة', 'Sports', 1, 21),
    ('ألعاب', 'Toys', 1, 22)
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 2) مستخدمون تجريبيون
-- ---------------------------------------------------------------------
insert into public.users (full_name, phone, password_hash, role, status, phone_verified) values
    ('سارة الحربي', '+966500000101', '$2y$10$/K/z4.hUmqmcY6nNZFmA3OSo2ZxygsEC0jL3l7lSx9/f1LKzucA4e', 'user', 'active', 1),
    ('فهد الجهني', '+966500000102', '$2y$10$/K/z4.hUmqmcY6nNZFmA3OSo2ZxygsEC0jL3l7lSx9/f1LKzucA4e', 'user', 'active', 1),
    ('نورة المطيري', '+966500000103', '$2y$10$/K/z4.hUmqmcY6nNZFmA3OSo2ZxygsEC0jL3l7lSx9/f1LKzucA4e', 'user', 'active', 1),
    ('عبدالله الرفاعي', '+966500000104', '$2y$10$/K/z4.hUmqmcY6nNZFmA3OSo2ZxygsEC0jL3l7lSx9/f1LKzucA4e', 'user', 'active', 1)
on conflict do nothing;


-- ---------------------------------------------------------------------
-- 3) حذف البيانات التجريبية السابقة (التطابقات تنحذف تلقائياً معها)
-- ---------------------------------------------------------------------
delete from public.lost_items where extra_attributes ->> 'seed' = 'demo';
delete from public.found_items where extra_attributes ->> 'seed' = 'demo';


-- ---------------------------------------------------------------------
-- 4) بلاغات الفاقد
-- ---------------------------------------------------------------------
insert into public.lost_items (
    user_id, category_id, item_type, title, description, brand, model, color, secondary_color,
    serial_number, distinctive_marks, lost_date, lost_time, location_details, latitude, longitude,
    location_accuracy, region_name, neighborhood_text, extra_attributes, status, visibility,
    admin_status, admin_note, created_at
)
select
    u.id, c.id, v.item_type, v.title, v.description, v.brand, v.model, v.color, v.secondary_color,
    v.serial_number, v.marks, v.lost_date::date, v.lost_time::time, v.location_details,
    v.lat, v.lng, v.accuracy, v.region, v.neighborhood, v.extra::jsonb, 'open', 'public',
    v.admin_status, v.admin_note, (v.lost_date::date + time '20:00') at time zone 'Asia/Riyadh'
from (values
    ('+966500000101', 'Electronics', 'جوال', 'جوال - Apple',
     'جوال آيفون 15 برو أسود بكفر شفاف، فيه خدش خفيف أعلى الشاشة.',
     'Apple', 'iPhone 15 Pro', 'أسود', null, 'IMEI-DEMO-1001',
     'ملصق نجمة صغير داخل الكفر من الخلف',
     '2026-11-05', '18:40', 'قرب مدخل مركز الياسمين التجاري', 24.0894200, 38.0632100, 12.5,
     'ينبع البحر', 'حي الصواري', '{"seed":"demo","key":"L1","frontend_item_type":"phone"}',
     'strong-match', 'يوجد بلاغ معثور مطابق بنسبة عالية'),

    ('+966500000102', 'Wallets', 'محفظة', 'محفظة',
     'محفظة جلد بنية صغيرة، فيها بطاقات بنكية وصورة عائلية.',
     null, null, 'بني', null, null,
     'الحرف F محفور في الزاوية',
     '2026-11-03', '21:15', 'كورنيش ينبع قرب الجلسات البحرية', 24.0812300, 38.0478800, 20.0,
     'ينبع البحر', 'حي الشاطئ', '{"seed":"demo","key":"L2","frontend_item_type":"wallet"}',
     'contact', 'تم التواصل مع العاثر لترتيب التسليم'),

    ('+966500000103', 'Keys', 'مفتاح سيارة', 'مفتاح سيارة - Toyota',
     'مفتاح سيارة تويوتا كامري أسود مع ميدالية جلد حمراء.',
     'Toyota', 'Camry 2022', 'أسود', 'أحمر', null,
     'ميدالية مكتوب عليها اسم مختصر',
     '2026-11-06', '09:30', 'مواقف مستشفى ينبع العام', 24.0961500, 38.0587600, 8.0,
     'ينبع البحر', 'حي البندر', '{"seed":"demo","key":"L3","frontend_item_type":"car"}',
     'review', null),

    ('+966500000104', 'Pets', 'قط', 'قط',
     'قطة بيضاء فيها بقع سوداء على الظهر، عيونها خضراء ولابسة طوق أزرق.',
     null, null, 'أبيض', 'أسود', null,
     'جرح صغير قديم في الأذن اليسرى',
     '2026-11-02', '17:00', 'قرب حديقة النخيل', 24.0743300, 38.0699500, 30.0,
     'ينبع البحر', 'حي النخيل', '{"seed":"demo","key":"L4","frontend_item_type":"cat","animal_name":"لولو"}',
     'verification', 'بانتظار تأكيد المالك من العلامة المميزة'),

    ('+966500000101', 'Documents', 'هوية', 'هوية',
     'بطاقة هوية وطنية داخل غلاف بلاستيكي شفاف.',
     null, null, 'أخضر', null, null,
     'الغلاف عليه ملصق قلب صغير',
     '2026-11-04', '13:10', 'داخل فرع بنك في الشارع التجاري', 23.9958700, 38.2289400, 15.0,
     'ينبع الصناعية', 'حي الرضوى', '{"seed":"demo","key":"L5","frontend_item_type":"id"}',
     'new', null),

    ('+966500000102', 'Jewelry', 'ساعة', 'ساعة - Casio',
     'ساعة كاسيو فضية بسوار معدني، شاشتها رقمية.',
     'Casio', 'A158W', 'فضي', null, null,
     'خدش على الزجاج جهة الرقم 3',
     '2026-10-30', '07:45', 'ممشى الدانة الرياضي', 24.0121800, 38.2142300, 10.0,
     'ينبع الصناعية', 'حي الدانة', '{"seed":"demo","key":"L6","frontend_item_type":"watch"}',
     'completed', 'تم تسليم الساعة لصاحبها'),

    ('+966500000103', 'Wallets', 'شنطة ظهر', 'شنطة ظهر',
     'شنطة ظهر زرقاء فيها لابتوب ودفاتر جامعية.',
     'Nike', null, 'أزرق', 'أسود', null,
     'سلسلة مفاتيح على شكل نجمة معلقة بالسحاب',
     '2026-11-07', '15:20', 'محطة الحافلات قرب الكلية التقنية', 24.0035600, 38.2401200, 25.0,
     'ينبع الصناعية', 'حي الفيروز', '{"seed":"demo","key":"L7","frontend_item_type":"backpack"}',
     'new', null),

    ('+966500000104', 'Personal Items', 'نظارة', 'نظارة',
     'نظارة طبية بإطار أسود داخل علبة رمادية.',
     'Ray-Ban', null, 'أسود', 'رمادي', null,
     null,
     '2026-11-01', '11:00', 'مطعم على الواجهة البحرية', 24.0850100, 38.0512400, 18.0,
     'ينبع البحر', 'حي الجابرية', '{"seed":"demo","key":"L8","frontend_item_type":"glasses"}',
     'rejected', 'البلاغ مكرر')
) as v (
    phone, category, item_type, title, description, brand, model, color, secondary_color,
    serial_number, marks, lost_date, lost_time, location_details, lat, lng, accuracy,
    region, neighborhood, extra, admin_status, admin_note
)
join public.users u on u.phone = v.phone
join public.categories c on c.name_en = v.category;


-- ---------------------------------------------------------------------
-- 5) بلاغات العاثر
-- ---------------------------------------------------------------------
insert into public.found_items (
    user_id, category_id, item_type, title, description, brand, model, color, secondary_color,
    distinctive_marks, found_date, found_time, location_details, latitude, longitude,
    location_accuracy, region_name, neighborhood_text, extra_attributes, status, visibility,
    admin_status, admin_note, created_at
)
select
    u.id, c.id, v.item_type, v.title, v.description, v.brand, v.model, v.color, v.secondary_color,
    v.marks, v.found_date::date, v.found_time::time, v.location_details, v.lat, v.lng, v.accuracy,
    v.region, v.neighborhood, v.extra::jsonb, 'available', 'public',
    v.admin_status, v.admin_note, (v.found_date::date + time '21:00') at time zone 'Asia/Riyadh'
from (values
    ('+966500000103', 'Electronics', 'جوال', 'جوال - Apple',
     'جوال آيفون أسود بكفر شفاف، الشاشة مقفلة.',
     'Apple', 'iPhone 15 Pro', 'أسود', null,
     'ملصق صغير داخل الكفر',
     '2026-11-05', '19:05', 'على طاولة في ساحة الطعام', 24.0897000, 38.0629800, 10.0,
     'ينبع البحر', 'حي الصواري', '{"seed":"demo","key":"F1","frontend_item_type":"phone"}',
     'strong-match', null),

    ('+966500000104', 'Wallets', 'محفظة', 'محفظة',
     'محفظة جلد بنية لقيتها على الرصيف، فيها بطاقات.',
     null, null, 'بني', null,
     'حرف محفور في الزاوية',
     '2026-11-03', '22:00', 'رصيف الكورنيش', 24.0815600, 38.0481100, 15.0,
     'ينبع البحر', 'حي الشاطئ', '{"seed":"demo","key":"F2","frontend_item_type":"wallet"}',
     'contact', 'سُلّمت للإدارة بانتظار المالك'),

    ('+966500000101', 'Keys', 'مفتاح سيارة', 'مفتاح سيارة - Toyota',
     'مفتاح تويوتا أسود معه ميدالية حمراء.',
     'Toyota', null, 'أسود', 'أحمر',
     'ميدالية عليها كتابة',
     '2026-11-06', '10:15', 'قرب بوابة الطوارئ', 24.0958800, 38.0590200, 12.0,
     'ينبع البحر', 'حي البندر', '{"seed":"demo","key":"F3","frontend_item_type":"car"}',
     'review', null),

    ('+966500000102', 'Pets', 'قط', 'قط',
     'قطة بيضاء وأسود، هادئة ولابسة طوق أزرق.',
     null, null, 'أبيض', 'أسود',
     'أثر جرح في الأذن',
     '2026-11-03', '08:30', 'داخل حديقة الحي', 24.0739900, 38.0705100, 25.0,
     'ينبع البحر', 'حي النخيل', '{"seed":"demo","key":"F4","frontend_item_type":"cat"}',
     'verification', 'القطة محفوظة عند العاثر'),

    ('+966500000104', 'Documents', 'هوية', 'هوية',
     'بطاقة هوية في غلاف شفاف لقيتها عند جهاز الصراف.',
     null, null, 'أخضر', null,
     'ملصق على الغلاف',
     '2026-11-04', '14:00', 'جهاز الصراف الآلي', 23.9961200, 38.2286000, 10.0,
     'ينبع الصناعية', 'حي الرضوى', '{"seed":"demo","key":"F5","frontend_item_type":"id"}',
     'new', null),

    ('+966500000103', 'Jewelry', 'ساعة', 'ساعة - Casio',
     'ساعة كاسيو فضية رقمية.',
     'Casio', null, 'فضي', null,
     'خدش على الزجاج',
     '2026-10-30', '18:20', 'دكة جلوس في الممشى', 24.0125000, 38.2139900, 8.0,
     'ينبع الصناعية', 'حي الدانة', '{"seed":"demo","key":"F6","frontend_item_type":"watch"}',
     'completed', 'تم التسليم'),

    ('+966500000101', 'Electronics', 'سماعات', 'سماعات - Sony',
     'سماعة رأس لاسلكية سوداء من سوني داخل علبتها.',
     'Sony', 'WH-1000XM5', 'أسود', null,
     null,
     '2026-11-06', '16:45', 'صالة الانتظار في المطار', 24.1442000, 38.0634000, 30.0,
     'ينبع البحر', 'حي السميري', '{"seed":"demo","key":"F7","frontend_item_type":"headphones"}',
     'new', null),

    ('+966500000102', 'Personal Items', 'مظلة', 'مظلة',
     'مظلة كبيرة زرقاء قابلة للطي.',
     null, null, 'أزرق', null,
     null,
     '2026-11-02', '12:30', 'مدخل السوق المركزي', 24.0018800, 38.2365500, 20.0,
     'ينبع الصناعية', 'حي الياقوت', '{"seed":"demo","key":"F8","frontend_item_type":"umbrella"}',
     'new', null)
) as v (
    phone, category, item_type, title, description, brand, model, color, secondary_color,
    marks, found_date, found_time, location_details, lat, lng, accuracy,
    region, neighborhood, extra, admin_status, admin_note
)
join public.users u on u.phone = v.phone
join public.categories c on c.name_en = v.category;


-- ---------------------------------------------------------------------
-- 6) التطابقات بين الفاقد والعاثر (تظهر في لوحة الإدارة)
-- ---------------------------------------------------------------------
insert into public.matches (
    lost_item_id, found_item_id, overall_score, category_score, description_score, location_score,
    date_score, color_score, brand_score, image_score, status
)
select l.id, f.id, v.overall, v.category, v.description, v.location, v.date, v.color, v.brand, 0, v.status
from (values
    ('L1', 'F1', 94.50, 100, 88, 98, 100, 100, 100, 'suggested'),
    ('L2', 'F2', 86.00, 100, 80, 95, 100, 100, 50, 'confirmed'),
    ('L3', 'F3', 90.25, 100, 85, 97, 100, 100, 100, 'viewed'),
    ('L4', 'F4', 81.75, 100, 78, 92, 85, 100, 50, 'suggested'),
    ('L5', 'F5', 88.00, 100, 82, 99, 100, 100, 50, 'suggested'),
    ('L6', 'F6', 92.00, 100, 86, 96, 100, 100, 100, 'completed'),
    ('L7', 'F8', 34.00, 40, 20, 70, 60, 100, 0, 'rejected')
) as v (lost_key, found_key, overall, category, description, location, date, color, brand, status)
join public.lost_items l on l.extra_attributes ->> 'seed' = 'demo' and l.extra_attributes ->> 'key' = v.lost_key
join public.found_items f on f.extra_attributes ->> 'seed' = 'demo' and f.extra_attributes ->> 'key' = v.found_key;

commit;


-- للتحقق:
-- select 'lost' as type, count(*) from public.lost_items union all
-- select 'found', count(*) from public.found_items union all
-- select 'matches', count(*) from public.matches;

-- لحذف كل البيانات التجريبية لاحقاً:
-- delete from public.lost_items  where extra_attributes ->> 'seed' = 'demo';
-- delete from public.found_items where extra_attributes ->> 'seed' = 'demo';
-- delete from public.users where phone in ('+966500000101','+966500000102','+966500000103','+966500000104');
