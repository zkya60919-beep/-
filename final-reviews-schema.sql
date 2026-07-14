-- Final Reviews Database Schema for Al-Basit Platform
-- This schema adds support for paid final reviews with multiple content types

-- Create final_reviews table
CREATE TABLE IF NOT EXISTS final_reviews (
    id SERIAL PRIMARY KEY,
    grade_id INTEGER REFERENCES grades(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_free BOOLEAN NOT NULL DEFAULT false,
    thumbnail VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create final_review_content table for storing different content types
CREATE TABLE IF NOT EXISTS final_review_content (
    id SERIAL PRIMARY KEY,
    final_review_id INTEGER REFERENCES final_reviews(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- 'video', 'pdf', 'audio', 'exam'
    title VARCHAR(255),
    description TEXT,
    file_url VARCHAR(500), -- For PDF, audio files
    video_url VARCHAR(500), -- For video URLs (YouTube, Cloudinary, etc.)
    exam_id INTEGER REFERENCES exams(id) ON DELETE SET NULL, -- For linking existing exams
    thumbnail VARCHAR(500),
    duration INTEGER, -- For videos in seconds
    file_size BIGINT, -- For file size tracking
    order_num INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create final_review_purchases table for tracking purchases
CREATE TABLE IF NOT EXISTS final_review_purchases (
    id SERIAL PRIMARY KEY,
    final_review_id INTEGER REFERENCES final_reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration for access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_final_reviews_grade_id ON final_reviews(grade_id);
CREATE INDEX IF NOT EXISTS idx_final_reviews_is_active ON final_reviews(is_active);
CREATE INDEX IF NOT EXISTS idx_final_reviews_order ON final_reviews(order_num);

CREATE INDEX IF NOT EXISTS idx_final_review_content_review_id ON final_review_content(final_review_id);
CREATE INDEX IF NOT EXISTS idx_final_review_content_type ON final_review_content(content_type);
CREATE INDEX IF NOT EXISTS idx_final_review_content_order ON final_review_content(order_num);

CREATE INDEX IF NOT EXISTS idx_final_review_purchases_review_id ON final_review_purchases(final_review_id);
CREATE INDEX IF NOT EXISTS idx_final_review_purchases_user_id ON final_review_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_final_review_purchases_status ON final_review_purchases(status);
CREATE INDEX IF NOT EXISTS idx_final_review_purchases_payment_id ON final_review_purchases(payment_id);

-- Enable Row Level Security
ALTER TABLE final_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_review_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_review_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for final_reviews
-- Public can read active final reviews
CREATE POLICY "Public can read active final reviews" ON final_reviews
    FOR SELECT USING (is_active = true);

-- Admin can insert, update, delete final reviews
CREATE POLICY "Admin can manage final reviews" ON final_reviews
    FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for final_review_content
-- Public can read content from active reviews
CREATE POLICY "Public can read final review content" ON final_review_content
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM final_reviews
            WHERE final_reviews.id = final_review_content.final_review_id
            AND final_reviews.is_active = true
        )
    );

-- Admin can manage final review content
CREATE POLICY "Admin can manage final review content" ON final_review_content
    FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for final_review_purchases
-- Users can read their own purchases
CREATE POLICY "Users can read own final review purchases" ON final_review_purchases
    FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own purchases
CREATE POLICY "Users can insert own final review purchases" ON final_review_purchases
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin can read all purchases
CREATE POLICY "Admin can read all final review purchases" ON final_review_purchases
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at on final_reviews
CREATE TRIGGER update_final_reviews_updated_at
    BEFORE UPDATE ON final_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on final_review_content
CREATE TRIGGER update_final_review_content_updated_at
    BEFORE UPDATE ON final_review_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user has purchased a final review
CREATE OR REPLACE FUNCTION has_purchased_final_review(user_id UUID, final_review_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM final_review_purchases
        WHERE final_review_purchases.user_id = user_id
        AND final_review_purchases.final_review_id = final_review_id
        AND final_review_purchases.status = 'completed'
        AND (final_review_purchases.expires_at IS NULL OR final_review_purchases.expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's purchased final reviews
CREATE OR REPLACE FUNCTION get_user_purchased_reviews(user_id UUID)
RETURNS TABLE (
    id INTEGER,
    final_review_id INTEGER,
    title VARCHAR,
    description TEXT,
    price DECIMAL,
    thumbnail VARCHAR,
    purchased_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        frp.id,
        frp.final_review_id,
        fr.title,
        fr.description,
        fr.price,
        fr.thumbnail,
        frp.purchased_at,
        frp.expires_at
    FROM final_review_purchases frp
    JOIN final_reviews fr ON fr.id = frp.final_review_id
    WHERE frp.user_id = user_id
    AND frp.status = 'completed'
    AND (frp.expires_at IS NULL OR frp.expires_at > NOW())
    ORDER BY frp.purchased_at DESC;
END;
$$ LANGUAGE plpgsql;
