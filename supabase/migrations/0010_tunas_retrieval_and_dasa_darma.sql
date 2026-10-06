-- KIWANTIKA Phase 10
-- Fixes natural-language retrieval and adds a verified Dasa Darma knowledge record.

-- One source-backed chunk per concept keeps retrieval precise and auditable.
insert into public.knowledge_sources(title, issuer, document_no, year, source_url, authority)
values (
  'Kode Kehormatan Pramuka — AD/ART',
  'Kwartir Nasional Gerakan Pramuka',
  'AD/ART Gerakan Pramuka',
  2019,
  'https://pramuka.or.id/files/document/AD-ART-GP-2019.pdf',
  'official_reference'
)
on conflict (source_url) do update set verified_at = now(), active = true;

insert into public.knowledge_chunks(source_id, title, audience, topic, keywords, content)
select
  s.id,
  'Dasa Darma — sepuluh nilai kode kehormatan',
  'Penggalang',
  'dasa darma',
  'dasa darma dasadarma kode kehormatan trisatya penggalang penegak pandega pembina sepuluh nilai',
  'Menurut rujukan resmi Kwarnas, Dasa Darma merupakan bagian dari Kode Kehormatan Pramuka dan digunakan untuk Penggalang, Penegak, Pandega, serta anggota dewasa. Sepuluh nilai pokoknya dapat diringkas sebagai: ketakwaan kepada Tuhan Yang Maha Esa; kecintaan pada alam dan kasih sayang kepada sesama; patriotisme yang sopan dan kesatria; kepatuhan dan musyawarah; kerelaan menolong dan ketabahan; kerajinan, keterampilan, dan kegembiraan; hidup hemat, cermat, dan bersahaja; disiplin, keberanian, dan kesetiaan; tanggung jawab dan dapat dipercaya; serta kesucian pikiran, perkataan, dan perbuatan. Untuk kutipan redaksi resmi lengkap, gunakan dokumen sumber Kwarnas yang ditautkan pada record ini dan jangan mengarang redaksi dari ingatan model.'
from public.knowledge_sources s
where s.source_url = 'https://pramuka.or.id/files/document/AD-ART-GP-2019.pdf'
  and s.active
  and not exists (
    select 1 from public.knowledge_chunks k
    where k.source_id = s.id and k.title = 'Dasa Darma — sepuluh nilai kode kehormatan'
  );

-- Natural-language retrieval should not require every filler word to exist in a chunk.
-- Example: "Apa isi Dasa Darma?" must resolve to the Dasa Darma chunk.
create or replace function public.search_pramuka_knowledge(
  p_query text,
  p_audience text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  title text,
  issuer text,
  document_no text,
  year integer,
  source_url text,
  audience text,
  topic text,
  content text,
  rank real
)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  with q as (
    select websearch_to_tsquery(
      'simple',
      regexp_replace(lower(left(coalesce(p_query, ''), 500)), '[^[:alnum:][:space:]-]', ' ', 'g')
    ) as tsq
  )
  select
    k.id, k.title, s.issuer, s.document_no, s.year, s.source_url,
    k.audience, k.topic, k.content,
    ts_rank_cd(k.search_vector, q.tsq)::real as rank
  from public.knowledge_chunks k
  join public.knowledge_sources s on s.id = k.source_id
  cross join q
  where k.active = true
    and s.active = true
    and (p_audience is null or k.audience = 'umum' or k.audience = p_audience)
    and (
      k.search_vector @@ q.tsq
      or lower(k.title || ' ' || k.topic || ' ' || k.keywords) like '%' || lower(trim(coalesce(p_query, ''))) || '%'
    )
  order by rank desc, k.created_at desc
  limit greatest(1, least(coalesce(p_limit, 8), 12));
$$;

revoke all on function public.search_pramuka_knowledge(text,text,integer) from public, anon, authenticated;
grant execute on function public.search_pramuka_knowledge(text,text,integer) to anon, authenticated;

comment on function public.search_pramuka_knowledge(text,text,integer) is
'Natural-language lexical retrieval for curated, source-backed Pramuka knowledge. Uses websearch_to_tsquery so filler words do not cause false abstention.';
