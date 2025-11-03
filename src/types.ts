type PostDto = {
  post_id: number;
  user_id: number;
  image_url_orig: string;
  image_url_censored: string | null;
  moderation_status: "PENDING" | "PASSED" | "REJECTED";
  status: "PENDING" | "PUBLISHED" | "DELETED";
  flagged: number;
  score_sum: number;
  rating_count: number;
  avg_rating: number | null;   // comes from SELECT ... AS avg_rating
  created_at: string;          // MySQL -> JSON string
};
