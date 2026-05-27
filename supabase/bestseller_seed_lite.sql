-- BestSeller Seed Lite
-- Run AFTER bestseller_supabase_schema.sql
-- This version DOES NOT insert into auth.users.
-- Before running this file, create these users manually in Supabase Authentication > Users:
--   admin@bestseller.do
--   camila@bestseller.do
--   luis@bestseller.do
--   sara@bestseller.do
--   joel@bestseller.do
--   ana@bestseller.do
--   diego@bestseller.do
-- Suggested password for all: Password123!

begin;

create temporary table demo_users on commit drop as
select id, lower(email) as email
from auth.users
where lower(email) in (
  'admin@bestseller.do',
  'camila@bestseller.do',
  'luis@bestseller.do',
  'sara@bestseller.do',
  'joel@bestseller.do',
  'ana@bestseller.do',
  'diego@bestseller.do'
);

do $$
declare
  missing text[];
begin
  select array_agg(email order by email) into missing
  from (
    select required_email as email
    from unnest(array[
      'admin@bestseller.do',
      'camila@bestseller.do',
      'luis@bestseller.do',
      'sara@bestseller.do',
      'joel@bestseller.do',
      'ana@bestseller.do',
      'diego@bestseller.do'
    ]) as required_email
    where required_email not in (select email from demo_users)
  ) q;

  if missing is not null then
    raise exception 'Faltan usuarios en auth.users: %', array_to_string(missing, ', ');
  end if;
end $$;

-- Make sure profile data is rich even on re-runs.
insert into public.profiles (id, email, full_name, phone, country_code, locale, headline, bio, avatar_url)
values
  ((select id from demo_users where email='admin@bestseller.do'),'admin@bestseller.do','Admin BestSeller','+18095550001','DO','es-DO','Administrador de plataforma','Gestiona catálogo, payouts, campañas y operaciones editoriales.','https://api.dicebear.com/7.x/initials/svg?seed=AB'),
  ((select id from demo_users where email='camila@bestseller.do'),'camila@bestseller.do','Camila Reyes','+18095550002','DO','es-DO','Autora de marketing editorial','Escribe sobre marca personal, lanzamientos y ventas de libros.','https://api.dicebear.com/7.x/initials/svg?seed=CR'),
  ((select id from demo_users where email='luis@bestseller.do'),'luis@bestseller.do','Luis Mena','+18095550003','DO','es-DO','Autor de finanzas prácticas','Ayuda a emprendedores a ordenar dinero, precios y flujo de caja.','https://api.dicebear.com/7.x/initials/svg?seed=LM'),
  ((select id from demo_users where email='sara@bestseller.do'),'sara@bestseller.do','Sara Núñez','+18095550004','DO','es-DO','Afiliada e influencer de lectura','Comparte recomendaciones, reseñas y campañas de libros digitales.','https://api.dicebear.com/7.x/initials/svg?seed=SN'),
  ((select id from demo_users where email='joel@bestseller.do'),'joel@bestseller.do','Joel Vargas','+18095550005','DO','es-DO','Afiliado de negocios y productividad','Promueve libros para emprendedores y audiencia profesional.','https://api.dicebear.com/7.x/initials/svg?seed=JV'),
  ((select id from demo_users where email='ana@bestseller.do'),'ana@bestseller.do','Ana Peguero','+18095550006','DO','es-DO','Lectora frecuente','Compra libros de marketing, finanzas y crecimiento personal.','https://api.dicebear.com/7.x/initials/svg?seed=AP'),
  ((select id from demo_users where email='diego@bestseller.do'),'diego@bestseller.do','Diego Herrera','+18095550007','DO','es-DO','Lector digital','Prefiere ebooks, reseñas rápidas y lectura desde el móvil.','https://api.dicebear.com/7.x/initials/svg?seed=DH')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  phone = excluded.phone,
  country_code = excluded.country_code,
  locale = excluded.locale,
  headline = excluded.headline,
  bio = excluded.bio,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.user_roles (user_id, role)
values
  ((select id from demo_users where email='admin@bestseller.do'),'admin'),
  ((select id from demo_users where email='camila@bestseller.do'),'author'),
  ((select id from demo_users where email='luis@bestseller.do'),'author'),
  ((select id from demo_users where email='sara@bestseller.do'),'affiliate'),
  ((select id from demo_users where email='joel@bestseller.do'),'affiliate')
on conflict (user_id, role) do nothing;

-- =====================================================
-- AUTHOR / AFFILIATE PROFILES + APPLICATIONS
-- =====================================================
insert into public.author_profiles (
  id, pen_name, slug, website_url, instagram_url, facebook_url, x_url, youtube_url,
  payout_details, royalty_rate, status, approved_at
)
values
  (
    (select id from demo_users where email='camila@bestseller.do'),
    'Camila Reyes',
    'camila-reyes',
    'https://camilareyes.example.com',
    'https://instagram.com/camilareyes',
    'https://facebook.com/camilareyes',
    'https://x.com/camilareyes',
    'https://youtube.com/@camilareyes',
    '{"method":"bank_transfer","bank":"Banreservas","account_name":"Camila Reyes","currency":"DOP"}',
    55.00,
    'approved',
    now() - interval '45 days'
  ),
  (
    (select id from demo_users where email='luis@bestseller.do'),
    'Luis Mena',
    'luis-mena',
    'https://luismena.example.com',
    'https://instagram.com/luismena',
    'https://facebook.com/luismena',
    'https://x.com/luismena',
    'https://youtube.com/@luismena',
    '{"method":"bank_transfer","bank":"Popular","account_name":"Luis Mena","currency":"DOP"}',
    50.00,
    'approved',
    now() - interval '30 days'
  )
on conflict (id) do update set
  pen_name = excluded.pen_name,
  slug = excluded.slug,
  website_url = excluded.website_url,
  instagram_url = excluded.instagram_url,
  facebook_url = excluded.facebook_url,
  x_url = excluded.x_url,
  youtube_url = excluded.youtube_url,
  payout_details = excluded.payout_details,
  royalty_rate = excluded.royalty_rate,
  status = excluded.status,
  approved_at = excluded.approved_at,
  updated_at = now();

insert into public.affiliate_profiles (
  id, display_name, handle, referral_code, payout_details, commission_rate, status, approved_at
)
values
  (
    (select id from demo_users where email='sara@bestseller.do'),
    'Sara Lee Libros',
    'saralee-libros',
    'AFF-SARA001',
    '{"method":"bank_transfer","bank":"BHD","account_name":"Sara Núñez","currency":"DOP"}',
    15.00,
    'approved',
    now() - interval '20 days'
  ),
  (
    (select id from demo_users where email='joel@bestseller.do'),
    'Joel Recomienda',
    'joel-recomienda',
    'AFF-JOEL001',
    '{"method":"bank_transfer","bank":"APAP","account_name":"Joel Vargas","currency":"DOP"}',
    12.00,
    'approved',
    now() - interval '10 days'
  )
on conflict (id) do update set
  display_name = excluded.display_name,
  handle = excluded.handle,
  referral_code = excluded.referral_code,
  payout_details = excluded.payout_details,
  commission_rate = excluded.commission_rate,
  status = excluded.status,
  approved_at = excluded.approved_at,
  updated_at = now();

insert into public.author_applications (
  id, user_id, legal_name, pen_name, email, phone, manuscript_title, genre, about,
  website_url, sample_link, status, reviewed_by, reviewed_at, admin_notes
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    (select id from demo_users where email='camila@bestseller.do'),
    'Camila Reyes',
    'Camila Reyes',
    'camila@bestseller.do',
    '+18095550002',
    'Marca que Vende',
    'Marketing',
    'Autora enfocada en marca personal y ventas editoriales.',
    'https://camilareyes.example.com',
    'https://example.com/samples/marca-que-vende.pdf',
    'approved',
    (select id from demo_users where email='admin@bestseller.do'),
    now() - interval '45 days',
    'Aplicación aprobada. Perfil editorial sólido.'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    (select id from demo_users where email='luis@bestseller.do'),
    'Luis Mena',
    'Luis Mena',
    'luis@bestseller.do',
    '+18095550003',
    'Finanzas Sin Enredo',
    'Finanzas',
    'Autor orientado a educación financiera simple y aplicada.',
    'https://luismena.example.com',
    'https://example.com/samples/finanzas-sin-enredo.pdf',
    'approved',
    (select id from demo_users where email='admin@bestseller.do'),
    now() - interval '30 days',
    'Aplicación aprobada. Potencial comercial alto.'
  )
on conflict (id) do nothing;

insert into public.affiliate_applications (
  id, user_id, display_name, email, phone, channels, audience_description,
  promo_experience, status, reviewed_by, reviewed_at, admin_notes
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    (select id from demo_users where email='sara@bestseller.do'),
    'Sara Lee Libros',
    'sara@bestseller.do',
    '+18095550004',
    '{"instagram":"https://instagram.com/saralee","tiktok":"https://tiktok.com/@saralee","youtube":"https://youtube.com/@saralee"}',
    'Audiencia interesada en productividad, lectura y emprendimiento.',
    'Ha promovido ebooks y clubes de lectura durante más de 2 años.',
    'approved',
    (select id from demo_users where email='admin@bestseller.do'),
    now() - interval '20 days',
    'Aprobada para campañas públicas.'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    (select id from demo_users where email='joel@bestseller.do'),
    'Joel Recomienda',
    'joel@bestseller.do',
    '+18095550005',
    '{"instagram":"https://instagram.com/joelrecomienda","newsletter":"https://joelrecomienda.example.com"}',
    'Audiencia de negocios, ventas y herramientas digitales.',
    'Promociona recursos para emprendedores y microempresas.',
    'approved',
    (select id from demo_users where email='admin@bestseller.do'),
    now() - interval '10 days',
    'Aprobado con comisión base de 12%.'
  )
on conflict (id) do nothing;

-- =====================================================
-- CATEGORIES
-- =====================================================
insert into public.categories (id, parent_id, name, slug, description, sort_order, is_active)
values
  ('30000000-0000-0000-0000-000000000001', null, 'Negocios', 'negocios', 'Libros de negocio, estrategia y ventas.', 1, true),
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Marketing', 'marketing', 'Marca personal, ventas, funnels y contenido.', 2, true),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Emprendimiento', 'emprendimiento', 'Guías prácticas para emprender y escalar.', 3, true),
  ('30000000-0000-0000-0000-000000000004', null, 'Finanzas', 'finanzas', 'Finanzas personales y empresariales.', 4, true),
  ('30000000-0000-0000-0000-000000000005', null, 'Desarrollo Personal', 'desarrollo-personal', 'Hábitos, enfoque y crecimiento.', 5, true),
  ('30000000-0000-0000-0000-000000000006', null, 'Autoedición', 'autoedicion', 'Publicación, maquetación y marketing para autores.', 6, true)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

-- =====================================================
-- BOOKS
-- =====================================================
insert into public.books (
  id, author_id, title, subtitle, slug, description_short, description_long, isbn_13,
  language_code, page_count, publication_date, status, featured, age_rating, cover_url, sample_url, metadata
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    (select id from demo_users where email='camila@bestseller.do'),
    'Marca que Vende',
    'Cómo convertir tu conocimiento en una marca editorial',
    'marca-que-vende',
    'Un manual práctico para autores y expertos que quieren vender mejor.',
    'Aprende a construir posicionamiento, oferta, mensaje, embudo y lanzamiento para que tu libro no salga al mercado a morir solo. Incluye ejercicios, checklists y una ruta de 30 días para convertir una idea en un activo comercial.',
    '9789945000001',
    'es',
    224,
    current_date - 50,
    'published',
    true,
    'ATP',
    'https://example.com/covers/marca-que-vende.jpg',
    'https://example.com/samples/marca-que-vende.pdf',
    '{"tags":["marca personal","autores","ventas"],"series":null,"seo_title":"Marca que Vende | BestSeller"}'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    (select id from demo_users where email='camila@bestseller.do'),
    'Tu Libro, Tu Negocio',
    'Sistema simple para vender libros impresos y digitales',
    'tu-libro-tu-negocio',
    'Una guía directa para monetizar tu libro como producto, oferta y plataforma.',
    'Este libro aterriza precios, bundles, afiliados, preventa, membresías y tráfico para que un autor construya una máquina comercial real alrededor de su obra.',
    '9789945000002',
    'es',
    198,
    current_date - 25,
    'published',
    true,
    'ATP',
    'https://example.com/covers/tu-libro-tu-negocio.jpg',
    'https://example.com/samples/tu-libro-tu-negocio.pdf',
    '{"tags":["publicación","embudos","afiliados"],"seo_title":"Tu Libro, Tu Negocio | BestSeller"}'
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    (select id from demo_users where email='luis@bestseller.do'),
    'Finanzas Sin Enredo',
    'Dinero claro para emprendedores y familias',
    'finanzas-sin-enredo',
    'Finanzas aterrizadas para gente real: precios, ahorro, deuda y flujo de caja.',
    'Luis Mena traduce conceptos financieros complejos a decisiones prácticas. El libro cubre presupuesto, márgenes, ahorro, deuda, metas y disciplina operativa con ejemplos simples.',
    '9789945000003',
    'es',
    256,
    current_date - 35,
    'published',
    true,
    'ATP',
    'https://example.com/covers/finanzas-sin-enredo.jpg',
    'https://example.com/samples/finanzas-sin-enredo.pdf',
    '{"tags":["finanzas","emprendedores","precios"],"seo_title":"Finanzas Sin Enredo | BestSeller"}'
  ),
  (
    '40000000-0000-0000-0000-000000000004',
    (select id from demo_users where email='luis@bestseller.do'),
    'Hábitos de Titanio',
    'Rutinas simples para ejecutar más y procrastinar menos',
    'habitos-de-titanio',
    'Hábitos diarios con enfoque brutalmente práctico.',
    'Un libro de productividad personal con microacciones, diseño de entorno, energía y disciplina. Pensado para quienes necesitan moverse sin vivir en una app de organización.',
    '9789945000004',
    'es',
    176,
    current_date - 12,
    'published',
    false,
    'ATP',
    'https://example.com/covers/habitos-de-titanio.jpg',
    'https://example.com/samples/habitos-de-titanio.pdf',
    '{"tags":["hábitos","productividad","enfoque"],"seo_title":"Hábitos de Titanio | BestSeller"}'
  )
on conflict (id) do update set
  author_id = excluded.author_id,
  title = excluded.title,
  subtitle = excluded.subtitle,
  slug = excluded.slug,
  description_short = excluded.description_short,
  description_long = excluded.description_long,
  isbn_13 = excluded.isbn_13,
  language_code = excluded.language_code,
  page_count = excluded.page_count,
  publication_date = excluded.publication_date,
  status = excluded.status,
  featured = excluded.featured,
  age_rating = excluded.age_rating,
  cover_url = excluded.cover_url,
  sample_url = excluded.sample_url,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.book_categories (book_id, category_id)
values
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000006'),
  ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000003'),
  ('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000005')
on conflict do nothing;

insert into public.book_editions (
  id, book_id, format, sku, edition_name, price, compare_at_price, currency,
  stock_quantity, unlimited_stock, is_preorder, release_date, file_url, external_url,
  weight_grams, dimensions, is_active, sort_order
)
values
  ('41000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','print','MQV-PRINT-001','Tapa blanda',890.00,990.00,'DOP',120,false,false,now() - interval '50 days',null,null,340,'{"width_cm":15.2,"height_cm":22.9,"depth_cm":1.8}',true,1),
  ('41000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','ebook','MQV-EBOOK-001','EPUB / PDF',390.00,490.00,'DOP',null,true,false,now() - interval '50 days','https://example.com/files/marca-que-vende.epub',null,null,'{}',true,2),
  ('41000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','kindle_external','MQV-KINDLE-001','Kindle Amazon',0,'0','DOP',null,true,false,now() - interval '50 days',null,'https://amazon.com/dp/MQVKINDLE',null,'{}',true,3),

  ('41000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000002','print','TLTN-PRINT-001','Tapa blanda',950.00,1050.00,'DOP',80,false,false,now() - interval '25 days',null,null,360,'{"width_cm":15.2,"height_cm":22.9,"depth_cm":1.6}',true,1),
  ('41000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000002','ebook','TLTN-EBOOK-001','EPUB / PDF',420.00,520.00,'DOP',null,true,false,now() - interval '25 days','https://example.com/files/tu-libro-tu-negocio.epub',null,null,'{}',true,2),

  ('41000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003','print','FSE-PRINT-001','Tapa blanda',990.00,1090.00,'DOP',90,false,false,now() - interval '35 days',null,null,380,'{"width_cm":15.2,"height_cm":22.9,"depth_cm":2.0}',true,1),
  ('41000000-0000-0000-0000-000000000007','40000000-0000-0000-0000-000000000003','ebook','FSE-EBOOK-001','EPUB / PDF',320.00,420.00,'DOP',null,true,false,now() - interval '35 days','https://example.com/files/finanzas-sin-enredo.epub',null,null,'{}',true,2),
  ('41000000-0000-0000-0000-000000000008','40000000-0000-0000-0000-000000000003','kindle_external','FSE-KINDLE-001','Kindle Amazon',0,'0','DOP',null,true,false,now() - interval '35 days',null,'https://amazon.com/dp/FSEKINDLE',null,'{}',true,3),

  ('41000000-0000-0000-0000-000000000009','40000000-0000-0000-0000-000000000004','print','HDT-PRINT-001','Tapa blanda',760.00,850.00,'DOP',60,false,false,now() - interval '12 days',null,null,290,'{"width_cm":14.0,"height_cm":21.0,"depth_cm":1.4}',true,1),
  ('41000000-0000-0000-0000-000000000010','40000000-0000-0000-0000-000000000004','ebook','HDT-EBOOK-001','EPUB / PDF',280.00,360.00,'DOP',null,true,false,now() - interval '12 days','https://example.com/files/habitos-de-titanio.epub',null,null,'{}',true,2)
on conflict (id) do update set
  book_id = excluded.book_id,
  format = excluded.format,
  sku = excluded.sku,
  edition_name = excluded.edition_name,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  currency = excluded.currency,
  stock_quantity = excluded.stock_quantity,
  unlimited_stock = excluded.unlimited_stock,
  is_preorder = excluded.is_preorder,
  release_date = excluded.release_date,
  file_url = excluded.file_url,
  external_url = excluded.external_url,
  weight_grams = excluded.weight_grams,
  dimensions = excluded.dimensions,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.book_assets (
  id, book_id, edition_id, asset_type, storage_bucket, storage_path, file_url, mime_type, is_public, sort_order
)
values
  ('42000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',null,'cover','book-covers','marca-que-vende/cover.jpg','https://example.com/covers/marca-que-vende.jpg','image/jpeg',true,1),
  ('42000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','epub','book-files','marca-que-vende/book.epub','https://example.com/files/marca-que-vende.epub','application/epub+zip',false,2),
  ('42000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001',null,'sample','book-files','marca-que-vende/sample.pdf','https://example.com/samples/marca-que-vende.pdf','application/pdf',true,3),
  ('42000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000003',null,'cover','book-covers','finanzas-sin-enredo/cover.jpg','https://example.com/covers/finanzas-sin-enredo.jpg','image/jpeg',true,1),
  ('42000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000007','epub','book-files','finanzas-sin-enredo/book.epub','https://example.com/files/finanzas-sin-enredo.epub','application/epub+zip',false,2),
  ('42000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000003',null,'sample','book-files','finanzas-sin-enredo/sample.pdf','https://example.com/samples/finanzas-sin-enredo.pdf','application/pdf',true,3)
on conflict (id) do update set
  book_id = excluded.book_id,
  edition_id = excluded.edition_id,
  asset_type = excluded.asset_type,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  file_url = excluded.file_url,
  mime_type = excluded.mime_type,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  updated_at = now();

-- =====================================================
-- REVIEWS + WISHLISTS
-- =====================================================
insert into public.book_reviews (
  id, book_id, user_id, rating, title, body, is_verified_purchase, is_published
)
values
  ('43000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',(select id from demo_users where email='ana@bestseller.do'),5,'Práctico y accionable','No es humo. Tiene pasos claros para lanzar y vender un libro sin dar veinte vueltas.',true,true),
  ('43000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003',(select id from demo_users where email='diego@bestseller.do'),5,'Finanzas aterrizadas','Explica márgenes, deuda y presupuesto con ejemplos de la vida real. Súper útil.',true,true),
  ('43000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000004',(select id from demo_users where email='ana@bestseller.do'),4,'Lectura rápida','Me gustó porque no romantiza la productividad y va directo al grano.',false,true)
on conflict (id) do nothing;

insert into public.wishlists (id, user_id, name)
values
  ('44000000-0000-0000-0000-000000000001',(select id from demo_users where email='ana@bestseller.do'),'Favoritos'),
  ('44000000-0000-0000-0000-000000000002',(select id from demo_users where email='diego@bestseller.do'),'Wishlist de Diego')
on conflict (id) do update set
  user_id = excluded.user_id,
  name = excluded.name,
  updated_at = now();

insert into public.wishlist_items (wishlist_id, book_id)
values
  ('44000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003'),
  ('44000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000004'),
  ('44000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- =====================================================
-- ADDRESSES + CARTS
-- =====================================================
insert into public.addresses (
  id, user_id, label, recipient_name, phone, country, province, city, address_line_1, address_line_2, postal_code,
  is_default_shipping, is_default_billing
)
values
  ('45000000-0000-0000-0000-000000000001',(select id from demo_users where email='ana@bestseller.do'),'Casa','Ana Peguero','+18095550006','República Dominicana','Distrito Nacional','Santo Domingo','Calle Rosa Duarte 12','Apto 3B','10101',true,true),
  ('45000000-0000-0000-0000-000000000002',(select id from demo_users where email='diego@bestseller.do'),'Oficina','Diego Herrera','+18095550007','República Dominicana','Santiago','Santiago de los Caballeros','Av. Juan Pablo Duarte 45',null,'51000',true,true)
on conflict (id) do update set
  user_id = excluded.user_id,
  label = excluded.label,
  recipient_name = excluded.recipient_name,
  phone = excluded.phone,
  country = excluded.country,
  province = excluded.province,
  city = excluded.city,
  address_line_1 = excluded.address_line_1,
  address_line_2 = excluded.address_line_2,
  postal_code = excluded.postal_code,
  is_default_shipping = excluded.is_default_shipping,
  is_default_billing = excluded.is_default_billing,
  updated_at = now();

insert into public.carts (
  id, user_id, session_id, currency, subtotal, discount_total, shipping_total, tax_total, total
)
values
  ('46000000-0000-0000-0000-000000000001',(select id from demo_users where email='diego@bestseller.do'),null,'DOP',760.00,0,250.00,0,1010.00)
on conflict (id) do update set
  user_id = excluded.user_id,
  session_id = excluded.session_id,
  currency = excluded.currency,
  subtotal = excluded.subtotal,
  discount_total = excluded.discount_total,
  shipping_total = excluded.shipping_total,
  tax_total = excluded.tax_total,
  total = excluded.total,
  updated_at = now();

insert into public.cart_items (
  id, cart_id, edition_id, quantity, unit_price, line_total, metadata
)
values
  ('46100000-0000-0000-0000-000000000001','46000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000009',1,760.00,760.00,'{"note":"Carrito demo"}')
on conflict (id) do update set
  cart_id = excluded.cart_id,
  edition_id = excluded.edition_id,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  line_total = excluded.line_total,
  metadata = excluded.metadata,
  updated_at = now();

-- =====================================================
-- COUPONS
-- =====================================================
insert into public.coupons (
  id, code, description, discount_type, discount_value, starts_at, ends_at,
  max_uses, used_count, minimum_order_amount, is_active
)
values
  ('47000000-0000-0000-0000-000000000001','BIENVENIDO10','10% en tu primera compra digital','percentage',10.00,now() - interval '90 days',now() + interval '365 days',1000,7,300.00,true),
  ('47000000-0000-0000-0000-000000000002','LANZAMIENTO150','RD$150 de descuento en lanzamiento','fixed',150.00,now() - interval '30 days',now() + interval '30 days',300,14,800.00,true)
on conflict (id) do update set
  code = excluded.code,
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  max_uses = excluded.max_uses,
  used_count = excluded.used_count,
  minimum_order_amount = excluded.minimum_order_amount,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.coupon_books (coupon_id, book_id)
values
  ('47000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001'),
  ('47000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003'),
  ('47000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000002')
on conflict do nothing;

-- =====================================================
-- ORDERS + PAYMENTS
-- =====================================================
insert into public.orders (
  id, user_id, order_number, status, payment_status, currency, subtotal, discount_total,
  shipping_total, tax_total, total, coupon_code, notes, billing_address, shipping_address,
  placed_at, paid_at
)
values
  (
    '48000000-0000-0000-0000-000000000001',
    (select id from demo_users where email='ana@bestseller.do'),
    'BS-20260330-10001',
    'paid',
    'paid',
    'DOP',
    1280.00,
    150.00,
    250.00,
    0,
    1380.00,
    'LANZAMIENTO150',
    'Pedido demo de Ana',
    '{"recipient_name":"Ana Peguero","phone":"+18095550006","country":"República Dominicana","province":"Distrito Nacional","city":"Santo Domingo","address_line_1":"Calle Rosa Duarte 12","postal_code":"10101"}',
    '{"recipient_name":"Ana Peguero","phone":"+18095550006","country":"República Dominicana","province":"Distrito Nacional","city":"Santo Domingo","address_line_1":"Calle Rosa Duarte 12","postal_code":"10101"}',
    now() - interval '7 days',
    now() - interval '7 days'
  ),
  (
    '48000000-0000-0000-0000-000000000002',
    (select id from demo_users where email='diego@bestseller.do'),
    'BS-20260330-10002',
    'paid',
    'paid',
    'DOP',
    320.00,
    0,
    0,
    0,
    320.00,
    null,
    'Pedido afiliado de Diego',
    '{"recipient_name":"Diego Herrera","phone":"+18095550007","country":"República Dominicana","province":"Santiago","city":"Santiago de los Caballeros","address_line_1":"Av. Juan Pablo Duarte 45","postal_code":"51000"}',
    '{"recipient_name":"Diego Herrera","phone":"+18095550007","country":"República Dominicana","province":"Santiago","city":"Santiago de los Caballeros","address_line_1":"Av. Juan Pablo Duarte 45","postal_code":"51000"}',
    now() - interval '3 days',
    now() - interval '3 days'
  )
on conflict (id) do update set
  user_id = excluded.user_id,
  order_number = excluded.order_number,
  status = excluded.status,
  payment_status = excluded.payment_status,
  currency = excluded.currency,
  subtotal = excluded.subtotal,
  discount_total = excluded.discount_total,
  shipping_total = excluded.shipping_total,
  tax_total = excluded.tax_total,
  total = excluded.total,
  coupon_code = excluded.coupon_code,
  notes = excluded.notes,
  billing_address = excluded.billing_address,
  shipping_address = excluded.shipping_address,
  placed_at = excluded.placed_at,
  paid_at = excluded.paid_at,
  updated_at = now();

insert into public.order_items (
  id, order_id, book_id, edition_id, title_snapshot, format_snapshot, sku_snapshot, quantity, unit_price, line_total
)
values
  ('48100000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','Marca que Vende','print','MQV-PRINT-001',1,890.00,890.00),
  ('48100000-0000-0000-0000-000000000002','48000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','Marca que Vende','ebook','MQV-EBOOK-001',1,390.00,390.00),
  ('48100000-0000-0000-0000-000000000003','48000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000007','Finanzas Sin Enredo','ebook','FSE-EBOOK-001',1,320.00,320.00)
on conflict (id) do update set
  order_id = excluded.order_id,
  book_id = excluded.book_id,
  edition_id = excluded.edition_id,
  title_snapshot = excluded.title_snapshot,
  format_snapshot = excluded.format_snapshot,
  sku_snapshot = excluded.sku_snapshot,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price,
  line_total = excluded.line_total;

insert into public.payments (
  id, order_id, provider, provider_reference, amount, currency, status, raw_response, paid_at
)
values
  ('48200000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000001','manual_demo','PAY-DEMO-10001',1380.00,'DOP','paid','{"provider":"manual_demo","status":"approved"}',now() - interval '7 days'),
  ('48200000-0000-0000-0000-000000000002','48000000-0000-0000-0000-000000000002','manual_demo','PAY-DEMO-10002',320.00,'DOP','paid','{"provider":"manual_demo","status":"approved"}',now() - interval '3 days')
on conflict (id) do update set
  order_id = excluded.order_id,
  provider = excluded.provider,
  provider_reference = excluded.provider_reference,
  amount = excluded.amount,
  currency = excluded.currency,
  status = excluded.status,
  raw_response = excluded.raw_response,
  paid_at = excluded.paid_at,
  updated_at = now();

-- =====================================================
-- LIBRARY + READING
-- =====================================================
insert into public.library_items (
  id, user_id, book_id, edition_id, order_item_id, access_type, granted_at, expires_at
)
values
  ('49000000-0000-0000-0000-000000000001',(select id from demo_users where email='ana@bestseller.do'),'40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002','48100000-0000-0000-0000-000000000002','purchase',now() - interval '7 days',null),
  ('49000000-0000-0000-0000-000000000002',(select id from demo_users where email='diego@bestseller.do'),'40000000-0000-0000-0000-000000000003','41000000-0000-0000-0000-000000000007','48100000-0000-0000-0000-000000000003','purchase',now() - interval '3 days',null),
  ('49000000-0000-0000-0000-000000000003',(select id from demo_users where email='sara@bestseller.do'),'40000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000005',null,'review_copy',now() - interval '15 days',now() + interval '45 days')
on conflict (id) do nothing;

insert into public.reading_progress (
  id, library_item_id, user_id, progress_percent, current_location, highlights, notes, last_opened_at
)
values
  ('49100000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001',(select id from demo_users where email='ana@bestseller.do'),38.50,'chapter-04','["Marca clara = mejor conversión","Oferta antes que portada"]','["Revisar checklist del lanzamiento"]',now() - interval '2 days'),
  ('49100000-0000-0000-0000-000000000002','49000000-0000-0000-0000-000000000002',(select id from demo_users where email='diego@bestseller.do'),72.00,'chapter-08','["Separar gastos fijos y variables"]','["Aplicar matriz de precios al negocio"]',now() - interval '1 day')
on conflict (id) do update set
  library_item_id = excluded.library_item_id,
  user_id = excluded.user_id,
  progress_percent = excluded.progress_percent,
  current_location = excluded.current_location,
  highlights = excluded.highlights,
  notes = excluded.notes,
  last_opened_at = excluded.last_opened_at,
  updated_at = now();

-- =====================================================
-- AFFILIATE CAMPAIGNS + LINKS + CLICKS + CONVERSIONS + COMMISSIONS
-- =====================================================
insert into public.affiliate_campaigns (
  id, book_id, author_id, name, slug, description, is_public, cookie_days,
  commission_type, commission_value, status, starts_at, ends_at
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    (select id from demo_users where email='camila@bestseller.do'),
    'Lanzamiento Marca que Vende',
    'lanzamiento-marca-que-vende',
    'Campaña abierta para afiliados del libro Marca que Vende.',
    true,
    30,
    'percentage',
    15.00,
    'active',
    now() - interval '20 days',
    now() + interval '40 days'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    (select id from demo_users where email='luis@bestseller.do'),
    'Campaña Finanzas Sin Enredo',
    'campana-finanzas-sin-enredo',
    'Campaña evergreen del ebook Finanzas Sin Enredo.',
    true,
    45,
    'percentage',
    15.00,
    'active',
    now() - interval '15 days',
    null
  )
on conflict (id) do update set
  book_id = excluded.book_id,
  author_id = excluded.author_id,
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  is_public = excluded.is_public,
  cookie_days = excluded.cookie_days,
  commission_type = excluded.commission_type,
  commission_value = excluded.commission_value,
  status = excluded.status,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  updated_at = now();

insert into public.affiliate_links (
  id, campaign_id, affiliate_id, code, destination_path, is_active
)
values
  ('50100000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',(select id from demo_users where email='sara@bestseller.do'),'LNK-SARA-MQV','/libros/marca-que-vende',true),
  ('50100000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',(select id from demo_users where email='sara@bestseller.do'),'LNK-SARA-FSE','/libros/finanzas-sin-enredo',true),
  ('50100000-0000-0000-0000-000000000003','50000000-0000-0000-0000-000000000001',(select id from demo_users where email='joel@bestseller.do'),'LNK-JOEL-MQV','/libros/marca-que-vende',true)
on conflict (id) do update set
  campaign_id = excluded.campaign_id,
  affiliate_id = excluded.affiliate_id,
  code = excluded.code,
  destination_path = excluded.destination_path,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.affiliate_clicks (
  id, affiliate_link_id, session_id, ip_hash, user_agent, referrer, landing_path, clicked_at
)
values
  ('50200000-0000-0000-0000-000000000001','50100000-0000-0000-0000-000000000001','sess-demo-ana','hash-ana-001','Mozilla/5.0','https://instagram.com','/libros/marca-que-vende',now() - interval '8 days'),
  ('50200000-0000-0000-0000-000000000002','50100000-0000-0000-0000-000000000002','sess-demo-diego','hash-diego-001','Mozilla/5.0','https://instagram.com','/libros/finanzas-sin-enredo',now() - interval '4 days'),
  ('50200000-0000-0000-0000-000000000003','50100000-0000-0000-0000-000000000003','sess-demo-joel-1','hash-joel-001','Mozilla/5.0','https://newsletter.example.com','/libros/marca-que-vende',now() - interval '6 days')
on conflict (id) do nothing;

insert into public.affiliate_conversions (
  id, affiliate_link_id, order_id, order_item_id, amount, currency, created_at
)
values
  ('50300000-0000-0000-0000-000000000001','50100000-0000-0000-0000-000000000002','48000000-0000-0000-0000-000000000002','48100000-0000-0000-0000-000000000003',320.00,'DOP',now() - interval '3 days')
on conflict (id) do update set
  affiliate_link_id = excluded.affiliate_link_id,
  order_id = excluded.order_id,
  order_item_id = excluded.order_item_id,
  amount = excluded.amount,
  currency = excluded.currency,
  created_at = excluded.created_at;

insert into public.affiliate_commissions (
  id, affiliate_id, campaign_id, conversion_id, order_id, order_item_id,
  commission_amount, currency, status, approved_at, paid_at
)
values
  ('50400000-0000-0000-0000-000000000001',(select id from demo_users where email='sara@bestseller.do'),'50000000-0000-0000-0000-000000000002','50300000-0000-0000-0000-000000000001','48000000-0000-0000-0000-000000000002','48100000-0000-0000-0000-000000000003',48.00,'DOP','paid',now() - interval '2 days',now() - interval '1 day')
on conflict (id) do update set
  affiliate_id = excluded.affiliate_id,
  campaign_id = excluded.campaign_id,
  conversion_id = excluded.conversion_id,
  order_id = excluded.order_id,
  order_item_id = excluded.order_item_id,
  commission_amount = excluded.commission_amount,
  currency = excluded.currency,
  status = excluded.status,
  approved_at = excluded.approved_at,
  paid_at = excluded.paid_at,
  updated_at = now();

-- =====================================================
-- PAYOUTS
-- =====================================================
insert into public.payouts (
  id, user_id, target, amount, currency, status, payment_reference, notes, processed_at
)
values
  ('51000000-0000-0000-0000-000000000001',(select id from demo_users where email='sara@bestseller.do'),'affiliate',48.00,'DOP','paid','PAYOUT-AFF-1001','Pago demo de comisión de afiliado.',now() - interval '1 day'),
  ('51000000-0000-0000-0000-000000000002',(select id from demo_users where email='camila@bestseller.do'),'author',355.00,'DOP','processing','PAYOUT-AUTH-1001','Pago demo de regalías del autor.',null)
on conflict (id) do update set
  user_id = excluded.user_id,
  target = excluded.target,
  amount = excluded.amount,
  currency = excluded.currency,
  status = excluded.status,
  payment_reference = excluded.payment_reference,
  notes = excluded.notes,
  processed_at = excluded.processed_at,
  updated_at = now();

insert into public.payout_items (
  id, payout_id, source_type, source_id, amount
)
values
  ('51100000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','affiliate_commission','50400000-0000-0000-0000-000000000001',48.00),
  ('51100000-0000-0000-0000-000000000002','51000000-0000-0000-0000-000000000002','order_royalty','48100000-0000-0000-0000-000000000001',245.00),
  ('51100000-0000-0000-0000-000000000003','51000000-0000-0000-0000-000000000002','order_royalty','48100000-0000-0000-0000-000000000002',110.00)
on conflict (id) do update set
  payout_id = excluded.payout_id,
  source_type = excluded.source_type,
  source_id = excluded.source_id,
  amount = excluded.amount;

-- =====================================================
-- NEWSLETTER + SETTINGS
-- =====================================================
insert into public.newsletter_subscribers (
  id, email, full_name, source, tags, is_active, subscribed_at
)
values
  ('52000000-0000-0000-0000-000000000001','lectora1@example.com','María Castillo','home_popup','["lectores","rd"]',true,now() - interval '14 days'),
  ('52000000-0000-0000-0000-000000000002','autor1@example.com','Pedro Gómez','author_landing','["autores","leads"]',true,now() - interval '9 days'),
  ('52000000-0000-0000-0000-000000000003','afiliado1@example.com','Karina Soto','affiliate_landing','["afiliados"]',true,now() - interval '6 days')
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  source = excluded.source,
  tags = excluded.tags,
  is_active = excluded.is_active,
  subscribed_at = excluded.subscribed_at,
  updated_at = now();

insert into public.site_settings (key, value, description, updated_at)
values
  ('general', '{"site_name":"BestSeller","default_currency":"DOP","locale":"es-DO","support_email":"hola@bestseller.do","country":"República Dominicana"}', 'Configuración general del sitio.', now()),
  ('branding', '{"primary":"#0B57D0","accent":"#C62828","background":"#FFFFFF","text":"#111111"}', 'Paleta editorial clara del proyecto.', now()),
  ('commerce', '{"free_shipping_threshold":2500,"default_shipping_fee":250,"allow_preorders":true,"guest_checkout":false}', 'Reglas comerciales básicas.', now()),
  ('affiliate_program', '{"enabled":true,"default_cookie_days":30,"default_commission_percent":10,"minimum_payout_amount":1000}', 'Configuración del programa de afiliados.', now()),
  ('reader', '{"enabled":true,"allow_notes":true,"allow_highlights":true,"download_epub":true}', 'Configuración del lector digital.', now())
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = excluded.updated_at;

commit;

-- =====================================================
-- DEMO ACCOUNTS
-- =====================================================
-- Password for all:
-- Password123!
--
-- admin@bestseller.do
-- camila@bestseller.do
-- luis@bestseller.do
-- sara@bestseller.do
-- joel@bestseller.do
-- ana@bestseller.do
-- diego@bestseller.do
