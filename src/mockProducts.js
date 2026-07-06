export const mockProducts = [
  {
    id: 1,
    title: 'Apple MacBook Air M2 (2022)',
    brand: 'Apple',
    category: 'Laptops',
    price: 395000,
    condition: 'New',
    stock_quantity: 5,
    images: [
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=80'
    ],
    description: '13.6-inch Liquid Retina display, Apple M2 chip, 8GB RAM, 256GB SSD. Lightweight and powerful — built for students who mean business.',
    specifications: JSON.stringify({
      'Processor': 'Apple M2 chip (8-core CPU, 8-core GPU)',
      'RAM': '8GB Unified Memory',
      'Storage': '256GB SSD',
      'Display': '13.6-inch Liquid Retina Display (2560 x 1664)',
      'Battery': 'Up to 18 hours',
      'OS': 'macOS Sonoma',
      'Weight': '1.24 kg (2.7 lbs)'
    }),
    useCases: ['Programming', 'Graphic Design', 'Business'],
    strengths: ['Excellent Battery', 'Portable', 'Premium Display'],
    ratings: {
      Gaming: 4.0,
      Programming: 9.0,
      Battery: 9.5,
      VideoEditing: 7.5,
      Portability: 9.5,
      Repairability: 3.0,
      Performance: 8.5,
      ValueForMoney: 9.0
    },
    reviews: [
      {
        id: 101,
        reviewer_name: 'Chinedu A.',
        reviewer_avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100',
        reviewer_university: 'Unilag',
        reviewer_year: '300L',
        rating: 5,
        comment: "Bought this for my 300L project work, it hasn't let me down once."
      },
      {
        id: 102,
        reviewer_name: 'Deborah I.',
        reviewer_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
        reviewer_university: 'Babcock University',
        reviewer_year: '400L',
        rating: 5,
        comment: 'Battery is crazy good, I can go all day on campus without stress.'
      },
      {
        id: 103,
        reviewer_name: 'Tobi O.',
        reviewer_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        reviewer_university: 'Covenant University',
        reviewer_year: '200L',
        rating: 4,
        comment: 'Super fast and lightweight. Perfect for lectures and editing.'
      }
    ]
  },
  {
    id: 2,
    title: 'HP Spectre x360 14',
    brand: 'HP',
    category: 'Laptops',
    price: 460000,
    condition: 'New',
    stock_quantity: 3,
    images: [
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Beautiful 2-in-1 convertible touchscreen laptop. Intel Core i7, 16GB RAM, 512GB SSD. High-end build quality with gorgeous display.',
    specifications: JSON.stringify({
      'Processor': 'Intel Core i7 Evo Platform',
      'RAM': '16GB LPDDR4x',
      'Storage': '512GB PCIe NVMe SSD',
      'Display': '14-inch OLED Touchscreen (3Kx2K)',
      'Battery': 'Up to 12 hours',
      'OS': 'Windows 11 Home',
      'Weight': '1.36 kg (3.0 lbs)'
    }),
    useCases: ['Business', 'Content Creation', 'Programming'],
    strengths: ['Premium Display', 'Portable', 'Upgradeable'],
    ratings: {
      Gaming: 5.0,
      Programming: 8.5,
      Battery: 7.5,
      VideoEditing: 8.0,
      Portability: 9.0,
      Repairability: 6.0,
      Performance: 8.5,
      ValueForMoney: 8.0
    },
    reviews: []
  },
  {
    id: 3,
    title: 'ASUS ROG Zephyrus G14',
    brand: 'ASUS',
    category: 'Laptops',
    price: 389000,
    condition: 'New',
    stock_quantity: 4,
    images: [
      'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Incredible portable gaming laptop. AMD Ryzen 7, NVIDIA RTX 4050 GPU, 16GB RAM, 1TB SSD. Built for students who enjoy gaming and heavy content creation.',
    specifications: JSON.stringify({
      'Processor': 'AMD Ryzen 7 7735HS (8-core)',
      'RAM': '16GB DDR5 Dual Channel',
      'Storage': '1TB NVMe PCIe 4.0 SSD',
      'Display': '14-inch ROG Nebula QHD 165Hz',
      'Battery': 'Up to 9 hours',
      'OS': 'Windows 11 Pro',
      'Weight': '1.72 kg (3.8 lbs)'
    }),
    useCases: ['Gaming', 'Video Editing', 'Programming', 'Architecture'],
    strengths: ['High Performance', 'Powerful GPU', 'Premium Display'],
    ratings: {
      Gaming: 9.5,
      Programming: 9.0,
      Battery: 6.5,
      VideoEditing: 9.0,
      Portability: 7.5,
      Repairability: 7.0,
      Performance: 9.5,
      ValueForMoney: 8.5
    },
    reviews: []
  },
  {
    id: 4,
    title: 'Dell XPS 13 (9315)',
    brand: 'Dell',
    category: 'Laptops',
    price: 410000,
    condition: 'Fairly Used',
    stock_quantity: 2,
    images: [
      'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Sleek CNC aluminum build. Intel Core i5, 16GB RAM, 512GB SSD. Perfect secondary machine or portable companion for lectures.',
    specifications: JSON.stringify({
      'Processor': 'Intel Core i5-1230U (10-core)',
      'RAM': '16GB LPDDR5',
      'Storage': '512GB PCIe NVMe SSD',
      'Display': '13.4-inch FHD+ InfinityEdge (1920 x 1200)',
      'Battery': 'Up to 11 hours',
      'OS': 'Windows 11 Home',
      'Weight': '1.17 kg (2.6 lbs)'
    }),
    useCases: ['Programming', 'Business', 'Law'],
    strengths: ['Portable', 'Durable', 'Quiet'],
    ratings: {
      Gaming: 3.5,
      Programming: 8.0,
      Battery: 8.0,
      VideoEditing: 6.0,
      Portability: 9.8,
      Repairability: 5.0,
      Performance: 7.5,
      ValueForMoney: 8.5
    },
    reviews: []
  },
  {
    id: 5,
    title: 'MacBook Air M1 (2020)',
    brand: 'Apple',
    category: 'Laptops',
    price: 285000,
    condition: 'Fairly Used',
    stock_quantity: 6,
    images: [
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'The legendary M1 MacBook Air. 8GB RAM, 256GB SSD. Whisper quiet fanless design with outstanding performance value.',
    specifications: JSON.stringify({
      'Processor': 'Apple M1 chip (8-core)',
      'RAM': '8GB Unified Memory',
      'Storage': '256GB SSD',
      'Display': '13.3-inch Retina Display',
      'Battery': 'Up to 15 hours',
      'OS': 'macOS Monterey',
      'Weight': '1.29 kg (2.8 lbs)'
    }),
    useCases: ['Programming', 'Business', 'Accounting'],
    strengths: ['Excellent Battery', 'Portable', 'Quiet'],
    ratings: {
      Gaming: 3.0,
      Programming: 8.5,
      Battery: 9.0,
      VideoEditing: 6.5,
      Portability: 9.5,
      Repairability: 2.0,
      Performance: 8.0,
      ValueForMoney: 9.8
    },
    reviews: []
  },
  {
    id: 6,
    title: 'iPhone 12 128GB',
    brand: 'Apple',
    category: 'Phones',
    price: 620000,
    condition: 'New',
    stock_quantity: 8,
    images: [
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Apple iPhone 12, 128GB capacity. Super Retina XDR display, A14 Bionic processor, Dual camera system. Brand new seal package.',
    specifications: JSON.stringify({
      'Screen': '6.1-inch OLED Super Retina XDR',
      'Processor': 'A14 Bionic Chip',
      'RAM': '4GB',
      'Camera': 'Dual 12MP (Wide and Ultra Wide)',
      'Battery': '2815 mAh',
      'Connectivity': '5G support'
    }),
    useCases: ['Content Creation', 'Business'],
    strengths: ['Premium Display', 'Portable', 'Fast Charging'],
    ratings: {
      Gaming: 7.0,
      Programming: 4.0,
      Battery: 7.0,
      VideoEditing: 7.5,
      Portability: 9.8,
      Performance: 8.5,
      ValueForMoney: 8.0
    },
    reviews: []
  },
  {
    id: 7,
    title: 'AirPods Pro 2',
    brand: 'Apple',
    category: 'Accessories',
    price: 160000,
    condition: 'New',
    stock_quantity: 12,
    images: [
      'https://images.unsplash.com/photo-1588449668365-d15e397f6787?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Active Noise Cancellation headphones, transparency mode, spatial audio. Long-lasting student companion for studying in libraries.',
    specifications: JSON.stringify({
      'Audio Chip': 'Apple H2 chip',
      'Battery': 'Up to 6 hours (30 hours with case)',
      'Charging': 'MagSafe case with speakers'
    }),
    useCases: ['Business', 'Content Creation'],
    strengths: ['Durable', 'Portable', 'Quiet'],
    ratings: {
      Portability: 10.0,
      Performance: 9.5,
      ValueForMoney: 8.5
    },
    reviews: []
  },
  {
    id: 8,
    title: 'Samsung Galaxy Tab S7',
    brand: 'Samsung',
    category: 'Tablets',
    price: 350000,
    condition: 'New',
    stock_quantity: 4,
    images: [
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80'
    ],
    description: 'Excellent tablet with high refresh rate display, included S-Pen stylus. Highly recommended for digital art, hand-written notes, and lecture reviews.',
    specifications: JSON.stringify({
      'Processor': 'Snapdragon 865 Plus',
      'RAM': '6GB',
      'Storage': '128GB (Expandable)',
      'Display': '11-inch LTPS LCD 120Hz',
      'Battery': '8000 mAh',
      'Stylus': 'S-Pen (In-box included)'
    }),
    useCases: ['Medicine', 'Law', 'Graphic Design'],
    strengths: ['Premium Display', 'Portable', 'Durable'],
    ratings: {
      Programming: 4.5,
      Battery: 8.5,
      Portability: 9.2,
      Performance: 8.0,
      ValueForMoney: 9.0
    },
    reviews: []
  }
];
