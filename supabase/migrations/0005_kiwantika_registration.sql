-- KIWANTIKA public registration form
DO $$
DECLARE
  v_form_id uuid;
  v_version_id uuid;
BEGIN
  INSERT INTO public.forms (title, slug, description, status, visibility, requires_auth, allow_edit, allow_multiple)
  VALUES (
    'Pendaftaran KIWANTIKA',
    'pendaftaran-kiwantika',
    'Formulir pendaftaran calon anggota KIWANTIKA — Ambalan Ki Hajar Dewantara – Dewi Sartika, SMAN 10 Garut.',
    'published', 'public', false, false, true
  )
  ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, description=EXCLUDED.description, status='published', visibility='public';

  SELECT id INTO v_form_id FROM public.forms WHERE slug='pendaftaran-kiwantika';

  SELECT id INTO v_version_id FROM public.form_versions WHERE form_id=v_form_id AND version_number=1;
  IF v_version_id IS NULL THEN
    INSERT INTO public.form_versions(form_id,version_number,schema_snapshot,published_at)
    VALUES(v_form_id,1,jsonb_build_object('version',1,'source','system'),now()) RETURNING id INTO v_version_id;
  END IF;

  INSERT INTO public.form_fields(form_version_id,field_key,label,description,type,required,position,options)
  VALUES
    (v_version_id,'nama','Nama lengkap','Nama sesuai identitas sekolah.','text',true,1,'[]'::jsonb),
    (v_version_id,'kelas','Kelas','Contoh: X-3.','text',true,2,'[]'::jsonb),
    (v_version_id,'nomor_hp','Nomor HP','Nomor yang aktif dan dapat dihubungi.','text',true,3,'[]'::jsonb),
    (v_version_id,'alasan','Alasan ingin bergabung','Bagian ini opsional.','long_text',false,4,'[]'::jsonb),
    (v_version_id,'izin_orang_tua','Izin orang tua','Pernyataan persetujuan orang tua/wali.','checkbox',true,5,'[]'::jsonb)
  ON CONFLICT (form_version_id,field_key) DO UPDATE SET label=EXCLUDED.label,description=EXCLUDED.description,type=EXCLUDED.type,required=EXCLUDED.required,position=EXCLUDED.position;
END $$;
