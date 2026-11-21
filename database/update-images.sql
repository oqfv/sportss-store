-- Run this once in the Supabase SQL Editor to switch an existing database
-- from the drawn icons to the real product photos.
-- (a fresh install from database.sql already has these paths)

update category set icon = 'images/categories/football.jpg' where name = 'Football';
update category set icon = 'images/categories/basketball.jpg' where name = 'Basketball';
update category set icon = 'images/categories/tennis.jpg' where name = 'Tennis';
update category set icon = 'images/categories/fitness.jpg' where name = 'Fitness';
update category set icon = 'images/categories/swimming.jpg' where name = 'Swimming';

update product set image_url = 'images/products/1.jpg' where name = 'Pro Match Football Size 5';
update product set image_url = 'images/products/2.jpg' where name = 'Training Football Size 4';
update product set image_url = 'images/products/3.jpg' where name = 'Firm Ground Football Boots';
update product set image_url = 'images/products/4.jpg' where name = 'Shin Guards with Ankle Sock';
update product set image_url = 'images/products/5.jpg' where name = 'Goalkeeper Gloves';
update product set image_url = 'images/products/6.jpg' where name = 'Portable Training Goal Set';
update product set image_url = 'images/products/7.jpg' where name = 'Official Size 7 Basketball';
update product set image_url = 'images/products/8.jpg' where name = 'Outdoor Rubber Basketball';
update product set image_url = 'images/products/9.jpg' where name = 'Adjustable Basketball Hoop';
update product set image_url = 'images/products/10.jpg' where name = 'High-Top Basketball Shoes';
update product set image_url = 'images/products/11.jpg' where name = 'Ball Pump with Needles';
update product set image_url = 'images/products/12.jpg' where name = 'Graphite Tennis Racket';
update product set image_url = 'images/products/13.jpg' where name = 'Beginner Aluminium Racket';
update product set image_url = 'images/products/14.jpg' where name = 'Tennis Balls (Can of 4)';
update product set image_url = 'images/products/15.jpg' where name = 'Polyester Racket String';
update product set image_url = 'images/products/16.jpg' where name = 'Tennis Racket Bag (6 rackets)';
update product set image_url = 'images/products/17.jpg' where name = 'Adjustable Dumbbell 2-24kg';
update product set image_url = 'images/products/18.jpg' where name = 'Yoga Mat 6mm';
update product set image_url = 'images/products/19.jpg' where name = 'Resistance Bands Set (5)';
update product set image_url = 'images/products/20.jpg' where name = 'Kettlebell 16kg';
update product set image_url = 'images/products/21.jpg' where name = 'Speed Jump Rope';
update product set image_url = 'images/products/22.jpg' where name = 'Foam Roller 45cm';
update product set image_url = 'images/products/23.jpg' where name = 'Anti-Fog Swimming Goggles';
update product set image_url = 'images/products/24.jpg' where name = 'Silicone Swim Cap';
update product set image_url = 'images/products/25.jpg' where name = 'Kickboard';
update product set image_url = 'images/products/26.jpg' where name = 'Men''s Swim Jammer';
update product set image_url = 'images/products/28.jpg' where name = 'Swim Fins (Short Blade)';
