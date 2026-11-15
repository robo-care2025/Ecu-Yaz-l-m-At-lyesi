-- Varsayılan atölye (adı ve telefonu panelden değiştirilebilir)
insert into workshops (id, name, phone, signature, address_form)
values ('00000000-0000-0000-0000-000000000001', 'E-Scooter Tamir Merkezi', '0535 647 11 11',
        'E-Scooter Tamir Merkezi · 0535 647 11 11', 'siz')
on conflict (id) do nothing;

select seed_workshop('00000000-0000-0000-0000-000000000001')
where not exists (select 1 from brand_groups where workshop_id = '00000000-0000-0000-0000-000000000001');
