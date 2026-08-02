UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','image/avif'],
    file_size_limit = 10485760
WHERE id = 'listing-images';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/gif','image/webp','image/avif'],
    file_size_limit = 5242880
WHERE id = 'avatars';