export type Post = {
  post_id: number; user_id: number;
  image_url_censored: string;
  avg: number|null; rating_count: number;
  created_at: string; display_name?: string;
  status: 'PUBLISHED'|'PENDING'|'DELETED';
  moderation_status: 'PENDING'|'PASSED'|'REJECTED';
};

export const MOCK_POSTS: Post[] = [
  { post_id:1, user_id:2, display_name: "User 2", image_url_censored:'/demo/car1.jpg', avg:7.8, rating_count:12, created_at:'2025-10-01', status:'PUBLISHED', moderation_status:'PASSED' },
  { post_id:2, user_id:3, display_name: "User 3", image_url_censored:'/demo/car2.jpg', avg:6.2, rating_count:5,  created_at:'2025-10-02', status:'PUBLISHED', moderation_status:'PENDING' },
  { post_id:3, user_id:1, display_name: "User 1", image_url_censored:'/demo/car3.jpg', avg:null, rating_count:0, created_at:'2025-10-03', status:'PUBLISHED', moderation_status:'PASSED' },
];

export const MOCK_USERSTATS = (id:number)=>({
  user_id:id, display_name:id===1?'You':`User ${id}`,
  post_count: id===1? 1: 2, follower_count: 10, following_count: 4,
  bookmark_count: 3, successful_matches: 3, eligible_to_post: false, remaining_to_post: 2,
});

export const MOCK_BOOKMARKS = [1,3];

export const MOCK_MESSAGES = {
  inbox: [
    { conversation_id: 101, other_user: 'User 2', last: 'Nice S15!', when: '2h' },
    { conversation_id: 102, other_user: 'User 3', last: 'DM sent', when: '1d' },
  ],
  threads: {
    101: [
      { id: 1, sender_id: 1, body: 'hey!', at: '2025-10-13 14:00' },
      { id: 2, sender_id: 2, body: 'Nice S15!', at: '2025-10-13 14:05' },
    ],
  } as Record<number, {id:number;sender_id:number;body:string;at:string}[]>,
};
