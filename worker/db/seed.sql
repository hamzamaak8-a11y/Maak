-- Idempotent seed of the 4 providers. Run in the Supabase dashboard SQL editor
-- (optional — POST /admin/seed does the same thing over HTTP).
insert into providers (id, name, job, city, distance, price, rating, reviews, image, available, services, experience, intro)
values
  (1, 'محمد العلوي', 'سباك محترف', 'طنجة', '2.4 كم', 'ابتداءً من 100 درهم', '4.9', 128, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=240&q=85', true, '["إصلاح التسربات","تركيب الصنابير","صيانة السخانات"]'::jsonb, '8 سنوات', 'أساعد العائلات في طنجة على حل مشاكل المياه والسباكة بسرعة وجودة متقنة، مع توضيح أسباب العطل والحلول المناسبة قبل أي تدخل.'),
  (2, 'سلمى بنعتيى', 'تنظيف المنازل', 'طنجة', '3.1 كم', 'ابتداءً من 150 درهم', '4.8', 74, 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=240&q=85', true, '["تنظيف شامل","تنظيف بعد الانتقال"]'::jsonb, '5 سنوات', 'خدمة تنظيف منظمة وموثوقة بعناية فائقة لكافة التفاصيل لضمان بيئة منزلية مريحة ونظيفة.'),
  (3, 'ياسين المرابط', 'كهربائي معتمد', 'طنجة', '4.7 كم', 'ابتداءً من 120 درهم', '4.9', 92, 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=240&q=85', false, '["تركيب الإنارة","إصلاح الأعطال","لوحات الكهرباء"]'::jsonb, '11 سنة', 'نقدم حلولاً كهربائية آمنة ومعتمدة للمنازل والمحلات بطنجة، من التشخيص الدقيق وحتى الصيانة والإصلاح الكامل.'),
  (4, 'عمر التازي', 'نقل وتركيب', 'تطوان', '12 كم', 'ابتداءً من 250 درهم', '4.7', 51, 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=240&q=85', true, '["نقل الأثاث","التركيب","التغليف"]'::jsonb, '6 سنوات', 'نقل احترافي للأثاث بكل عناية وأمان من الباب إلى الباب مع خدمات التغليف والتركيب الدقيق.')
on conflict (id) do update set
  name = excluded.name, job = excluded.job, city = excluded.city, distance = excluded.distance,
  price = excluded.price, rating = excluded.rating, reviews = excluded.reviews, image = excluded.image,
  available = excluded.available, services = excluded.services, experience = excluded.experience, intro = excluded.intro;
