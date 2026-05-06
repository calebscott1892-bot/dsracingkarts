-- ============================================================
-- DS Racing Karts - team #83 logo + category thumbnails
-- Safe to run more than once.
-- ============================================================

update team_profiles
set
  kart_number = '83',
  logo_url = '/images/history/Skidmark Logo.jpeg',
  is_active = true
where lower(team_name) like '%skid mark%';

update categories as c
set image_url = v.image_url
from (
  values
    ('accessories-karting', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/816a690aafa801670401f5c6a119babc43f76417/original.jpeg'),
    ('axles-components', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('bearings', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('brakes-components', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('car-racing', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/bbc3d0c9aa03c560c78aec286a08442d486753a2/original.jpeg'),
    ('chains', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('chassis-2', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/6e681d0a8a658e85b35d5fdfa3bb821f78db3360/original.png'),
    ('chassis-components-2', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/2e431f245390debb1217fbc973e1f92003943526/original.jpeg'),
    ('engines-accessories-2', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('fuel-tank-accessories', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/2c215f96430e4b9785945c6e41bcd40c12ce0683/original.jpeg'),
    ('helmets', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('miscellaneous', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('nuts-bolts-washers', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('protective-gear', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/811058fe7c08b13b8614510a7f01c2e005e1a6ed/original.jpeg'),
    ('racewear', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/ed6dfc8bd1008eed99c6b2a048898dc60dbcffca/original.png'),
    ('services', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/29d95bde0b3b2ac7e09f86c4aa04aaba1ad0e905/original.jpeg'),
    ('sprockets-carriers', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/d4d952bf797fcdda88ad342659031331de09fca1/original.jpeg'),
    ('steering-components', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/1c2780ecc32651bf8147ac0fd5581a13ab22cc48/original.jpeg'),
    ('sticker-kits', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a7b76ecf7fd6f88b5d8282be961aea230a14a030/original.png'),
    ('wheels-accessories-2', 'https://items-images-production.s3.us-west-2.amazonaws.com/files/a0db3ebd274c810375f6821bfb995f37ae74eb7a/original.jpeg')
) as v(slug, image_url)
where c.slug = v.slug
  and c.parent_id is null;
