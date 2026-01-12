import { createStore } from 'zustand'
import type { Features } from './types'
// 补回 Resolution 导入（文件上传功能依赖此类型）
import { Resolution, TransferMethod } from '@/types/app'

export type FeaturesModal = {
  showFeaturesModal: boolean
  setShowFeaturesModal: (showFeaturesModal: boolean) => void
}

export type FeaturesState = {
  features: Features
}

export type FeaturesAction = {
  setFeatures: (features: Features) => void
}

export type FeatureStoreState = FeaturesState & FeaturesAction & FeaturesModal

export type FeaturesStore = ReturnType<typeof createFeaturesStore>

export const createFeaturesStore = (initProps?: Partial<FeaturesState>) => {
  const DEFAULT_PROPS: FeaturesState = {
    features: {
      opening: {
        enabled: false,
      },
      suggested: {
        enabled: false,
      },
      text2speech: {
        enabled: false,
      },
      speech2text: {
        enabled: false,
      },
      citation: {
        enabled: false,
      },
      moderation: {
        enabled: false,
      },
      file: {
        // 1. 启用图片上传（核心：enabled 改为 true，否则按钮隐藏）
        image: {
          enabled: true,
          detail: Resolution.high, // 补回缺失的 detail 字段（类型依赖）
          number_limits: 10, // 扩展多文件数量限制（默认3改为10，适配多文件）
          transfer_methods: [TransferMethod.local_file, TransferMethod.remote_url],
        },
        // 2. 新增通用文件上传配置（适配多文件/非图片场景，按需扩展）
        general: {
          enabled: true, // 启用通用文件上传
          number_limits: 10, // 多文件数量限制
          transfer_methods: [TransferMethod.local_file], // 支持本地文件上传
          // 可选：扩展支持的文件类型（如果 types 里定义了）
          // file_types: ['pdf', 'doc', 'txt', 'jpg', 'png'],
        },
      },
      // 恢复缺失的功能节点（避免类型不匹配导致功能异常）
      moreLikeThis: {
        enabled: false,
      },
      annotationReply: {
        enabled: false,
      },
    },
  }
  return createStore<FeatureStoreState>()(set => ({
    ...DEFAULT_PROPS,
    ...initProps,
    setFeatures: features => set(() => ({ features })),
    showFeaturesModal: false,
    setShowFeaturesModal: showFeaturesModal => set(() => ({ showFeaturesModal })),
  }))
}