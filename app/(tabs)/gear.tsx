// app/(tabs)/gear.tsx
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
} from 'react-native'
import {
  CATEGORIES, filterProducts, openProduct,
  type CategoryId, type GearProduct,
} from '@/data/gearCatalog'

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  'TOP PICK':  { bg: '#6FE3FF22', color: '#6FE3FF' },
  'BUDGET':    { bg: '#5BE3A122', color: '#5BE3A1' },
  'ESSENTIAL': { bg: '#FFB85C22', color: '#FFB85C' },
}

function ProductCard({ product }: { product: GearProduct }) {
  const badge = product.badge ? BADGE_STYLE[product.badge] : null

  return (
    <View className="bg-surface2 rounded-2xl border border-line p-4 mb-3">
      <View className="flex-row justify-between items-start mb-1">
        <Text style={{ color: '#e7ecf5' }} className="text-sm font-bold flex-1 mr-2" numberOfLines={2}>
          {product.name}
        </Text>
        {badge && (
          <View
            className="rounded-full px-2 py-0.5"
            style={{ backgroundColor: badge.bg }}
          >
            <Text style={{ color: badge.color, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>
              {product.badge}
            </Text>
          </View>
        )}
      </View>
      <Text className="text-dim text-xs mb-3" numberOfLines={1}>{product.tagline}</Text>
      <View className="flex-row justify-between items-center">
        <Text style={{ color: '#e7ecf5' }} className="text-base font-bold font-mono">
          {product.price}
        </Text>
        <TouchableOpacity
          className="bg-accent rounded-xl px-4 py-2"
          onPress={() => openProduct(product)}
          activeOpacity={0.8}
        >
          <Text className="text-bg font-bold text-xs">SHOP NOW →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function GearScreen() {
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all')
  const products = filterProducts(activeCategory)

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-5 pt-14 pb-3">
        <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold mb-0.5">Pilot Gear</Text>
        <Text className="text-dim text-xs">Everything you need to fly for real.</Text>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setActiveCategory(cat.id as CategoryId | 'all')}
              className="rounded-full px-4 py-2"
              style={{
                backgroundColor: active ? '#6FE3FF' : '#1C2548',
                borderWidth: 1,
                borderColor: active ? '#6FE3FF' : '#2A3560',
              }}
            >
              <Text style={{ color: active ? '#0B0F1E' : '#8A9BC4', fontWeight: '600', fontSize: 12 }}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Product list */}
      <FlatList
        data={products}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <ProductCard product={item} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Text className="text-dim text-xs text-center mt-2 mb-4">
            Links are affiliate links. We may earn a commission at no cost to you.
          </Text>
        }
      />
    </View>
  )
}
