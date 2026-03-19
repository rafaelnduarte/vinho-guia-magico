CREATE UNIQUE INDEX idx_wines_website_url_unique 
ON wines (website_url) 
WHERE website_url IS NOT NULL AND website_url != '';