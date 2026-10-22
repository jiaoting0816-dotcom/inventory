CREATE TABLE media (key TEXT PRIMARY KEY NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL);
CREATE TABLE media_chunks (media_key TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(media_key,part));
