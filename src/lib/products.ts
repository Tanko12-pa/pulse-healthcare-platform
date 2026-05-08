export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'medication' | 'equipment' | 'wellness' | 'supplement';
  image: string;
  stock: number;
  rating: number;
}

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Pulse Pro Heart Rate Monitor',
    description: 'A clinical-grade chest strap monitor for accurate heart rate tracking during exercise and sleep.',
    price: 89.99,
    category: 'equipment',
    image: 'https://picsum.photos/seed/heartmonitor/400/400',
    stock: 24,
    rating: 4.8
  },
  {
    id: 'p2',
    name: 'Advanced Omega-3 Supplements',
    description: 'High-potency molecularly distilled fish oil for heart, brain, and joint support.',
    price: 34.50,
    category: 'supplement',
    image: 'https://picsum.photos/seed/omega3/400/400',
    stock: 156,
    rating: 4.9
  },
  {
    id: 'p3',
    name: 'Digital Sphygmomanometer',
    description: 'Bluetooth-connected blood pressure monitor with clinical-grade accuracy and easy-to-read display.',
    price: 59.00,
    category: 'equipment',
    image: 'https://picsum.photos/seed/bpmonitor/400/400',
    stock: 12,
    rating: 4.7
  },
  {
    id: 'p4',
    name: 'Sleep Support Melatonin 5mg',
    description: 'Non-habit forming quick-dissolve tablets to help you fall asleep faster and stay asleep longer.',
    price: 18.99,
    category: 'wellness',
    image: 'https://picsum.photos/seed/sleep/400/400',
    stock: 89,
    rating: 4.6
  },
  {
    id: 'p5',
    name: 'Orthopedic Lumbar Support',
    description: 'Ergonomic back support cushion for office chairs, designed by physical therapists.',
    price: 45.00,
    category: 'equipment',
    image: 'https://picsum.photos/seed/lumbar/400/400',
    stock: 35,
    rating: 4.5
  },
  {
    id: 'p6',
    name: 'Pulse Vitamin D3 + K2',
    description: 'Optimized bone and immune system support with 5000 IU of Vitamin D3 and 100mcg of K2.',
    price: 28.00,
    category: 'supplement',
    image: 'https://picsum.photos/seed/vitamind/400/400',
    stock: 210,
    rating: 4.9
  }
];
