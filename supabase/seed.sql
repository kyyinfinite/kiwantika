insert into public.organizational_positions(name,description) values
('Pradana','Pimpinan ambalan'),('Kerani','Administrasi ambalan'),('Juru Uang','Keuangan ambalan') on conflict do nothing;
