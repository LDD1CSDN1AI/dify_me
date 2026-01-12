'use client'
import type { FC } from 'react'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useContext } from 'use-context-selector'
import ModalFoot from '../modal-foot'
import ConfigSelect from '../config-select'
import ConfigString from '../config-string'
import SelectTypeItem from '../select-type-item'
import Field from './field'
import Toast from '@/app/components/base/toast'
import { checkKeys, getNewVarInWorkflow } from '@/utils/var'
import ConfigContext from '@/context/debug-configuration'
import type { InputVar, MoreInfo, UploadFileSetting } from '@/app/components/workflow/types'
import FileUploadSetting from '@/app/components/workflow/nodes/_base/components/file-upload-setting'
import Modal from '@/app/components/base/modal'
import Switch from '@/app/components/base/switch'
import { ChangeType, InputVarType, SupportUploadFileTypes } from '@/app/components/workflow/types'
import produce from 'immer'
import { DEFAULT_FILE_UPLOAD_SETTING } from '@/app/components/workflow/constants'
import { DEFAULT_VALUE_MAX_LEN } from '@/config'

const TEXT_MAX_LENGTH = 256
const PARAGRAPH_MAX_LENGTH = 1032 * 32

export type IConfigModalProps = {
  isCreate?: boolean
  payload?: InputVar
  isShow: boolean
  varKeys?: string[]
  onClose: () => void
  onConfirm: (newValue: InputVar, moreInfo?: MoreInfo) => void
}

const inputClassName = 'w-full px-3 text-sm leading-9 text-gray-900 border-0 rounded-lg grow h-9 bg-gray-100 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gray-200'

const ConfigModal: FC<IConfigModalProps> = ({
  isCreate,
  payload,
  isShow,
  onClose,
  onConfirm,
}) => {
  const { modelConfig } = useContext(ConfigContext)
  const { t } = useTranslation()
  const [tempPayload, setTempPayload] = useState<InputVar>(payload || getNewVarInWorkflow('') as any)
  const { type, label, variable, options, max_length } = tempPayload

  const checkVariableName = useCallback((value: string, canBeEmpty?: boolean) => {
    const { isValid, errorMessageKey } = checkKeys([value], canBeEmpty)
    if (!isValid) {
      Toast.notify({
        type: 'error',
        message: t(`appDebug.varKeyError.${errorMessageKey}`, { key: t('appDebug.variableConfig.varName') }),
      })
      return false
    }
    return true
  }, [t])

  const isStringInput = type === InputVarType.textInput || type === InputVarType.paragraph
  const handlePayloadChange = useCallback((key: string) => {
    return (value: any) => {
      if (key === 'variable') {
        const { isValid, errorKey, errorMessageKey } = checkKeys([value], true)
        if (!isValid) {
          Toast.notify({
            type: 'error',
            message: t(`appDebug.varKeyError.${errorMessageKey}`, { key: errorKey }),
          })
          return
        }
      }
      setTempPayload((prev) => {
        const newPayload = {
          ...prev,
          [key]: value,
        }

        return newPayload
      })
    }
  }, [t])

  const handleTypeChange = useCallback((type: InputVarType) => {
    return () => {
      const newPayload = produce(tempPayload, (draft) => {
        draft.type = type
        // 初始化单文件/多文件的上传配置
        if ([InputVarType.singleFile, InputVarType.multiFiles].includes(type)) {
          Object.keys(DEFAULT_FILE_UPLOAD_SETTING).forEach((key) => {
            if (key !== 'max_length') {
              (draft as any)[key] = (DEFAULT_FILE_UPLOAD_SETTING as any)[key]
            }
          })
          // 多文件默认使用配置的最大长度
          if (type === InputVarType.multiFiles) {
            draft.max_length = DEFAULT_FILE_UPLOAD_SETTING.max_length
          }
        }
        // 段落类型初始化最大长度
        if (type === InputVarType.paragraph) {
          draft.max_length = DEFAULT_VALUE_MAX_LEN
        }
      })

      setTempPayload(newPayload)
    }
  }, [tempPayload])

  const handleVarKeyBlur = useCallback((e: any) => {
    if (tempPayload.label) return

    setTempPayload((prev) => ({
      ...prev,
      label: e.target.value,
    }))
  }, [tempPayload])

  const handleConfirm = () => {
    const moreInfo = tempPayload.variable === payload?.variable
      ? undefined
      : {
        type: ChangeType.changeVarName,
        payload: { beforeKey: payload?.variable || '', afterKey: tempPayload.variable },
      }

    // 校验变量名
    const isVariableNameValid = checkVariableName(tempPayload.variable)
    if (!isVariableNameValid) return

    // 校验标签名
    if (!tempPayload.label) {
      Toast.notify({ type: 'error', message: t('appDebug.variableConfig.errorMsg.labelNameRequired') })
      return
    }

    // 字符串/数字类型
    if (isStringInput || type === InputVarType.number) {
      onConfirm(tempPayload, moreInfo)
    }
    // 下拉选择类型
    else if (type === InputVarType.select) {
      if (options?.length === 0) {
        Toast.notify({ type: 'error', message: t('appDebug.variableConfig.errorMsg.atLeastOneOption') })
        return
      }
      // 校验选项重复
      const optionMap: Record<string, boolean> = {}
      let hasRepeatedItem = false
      options?.forEach((o) => {
        if (optionMap[o]) {
          hasRepeatedItem = true
          return
        }
        optionMap[o] = true
      })
      if (hasRepeatedItem) {
        Toast.notify({ type: 'error', message: t('appDebug.variableConfig.errorMsg.optionRepeat') })
        return
      }
      onConfirm(tempPayload, moreInfo)
    }
    // 单文件/多文件类型
    else if ([InputVarType.singleFile, InputVarType.multiFiles].includes(type)) {
      // 校验文件类型是否选择
      if (tempPayload.allowed_file_types?.length === 0) {
        const errorMessages = t('workflow.errorMsg.fieldRequired', { field: t('appDebug.variableConfig.file.supportFileTypes') })
        Toast.notify({ type: 'error', message: errorMessages })
        return
      }
      // 校验自定义文件扩展名
      if (tempPayload.allowed_file_types?.includes(SupportUploadFileTypes.custom) && !tempPayload.allowed_file_extensions?.length) {
        const errorMessages = t('workflow.errorMsg.fieldRequired', { field: t('appDebug.variableConfig.file.custom.name') })
        Toast.notify({ type: 'error', message: errorMessages })
        return
      }
      onConfirm(tempPayload, moreInfo)
    }
    // 其他类型直接确认
    else {
      onConfirm(tempPayload, moreInfo)
    }
  }

  return (
    <Modal
      title={t(`appDebug.variableConfig.${isCreate ? 'addModalTitle' : 'editModalTitle'}`)}
      isShow={isShow}
      onClose={onClose}
    >
      <div className='mb-8'>
        <div className='space-y-2'>
          {/* 字段类型选择 */}
          <Field title={t('appDebug.variableConfig.fieldType')}>
            <div className='grid grid-cols-3 gap-2'>
              <SelectTypeItem type={InputVarType.textInput} selected={type === InputVarType.textInput} onClick={handleTypeChange(InputVarType.textInput)} />
              <SelectTypeItem type={InputVarType.paragraph} selected={type === InputVarType.paragraph} onClick={handleTypeChange(InputVarType.paragraph)} />
              <SelectTypeItem type={InputVarType.select} selected={type === InputVarType.select} onClick={handleTypeChange(InputVarType.select)} />
              <SelectTypeItem type={InputVarType.number} selected={type === InputVarType.number} onClick={handleTypeChange(InputVarType.number)} />
              <SelectTypeItem type={InputVarType.singleFile} selected={type === InputVarType.singleFile} onClick={handleTypeChange(InputVarType.singleFile)} />
              {/* 恢复多文件类型选择项 */}
              <SelectTypeItem type={InputVarType.multiFiles} selected={type === InputVarType.multiFiles} onClick={handleTypeChange(InputVarType.multiFiles)} />
            </div>
          </Field>

          {/* 变量名 */}
          <Field title={t('appDebug.variableConfig.varName')}>
            <input
              type='text'
              className={inputClassName}
              value={variable}
              onChange={e => handlePayloadChange('variable')(e.target.value)}
              onBlur={handleVarKeyBlur}
              placeholder={t('appDebug.variableConfig.inputPlaceholder')!}
            />
          </Field>

          {/* 标签名 */}
          <Field title={t('appDebug.variableConfig.labelName')}>
            <input
              type='text'
              className={inputClassName}
              value={label as string}
              onChange={e => handlePayloadChange('label')(e.target.value)}
              placeholder={t('appDebug.variableConfig.inputPlaceholder')!}
            />
          </Field>

          {/* 字符串/段落类型 - 最大长度配置 */}
          {isStringInput && (
            <Field title={t('appDebug.variableConfig.maxLength')}>
              <ConfigString
                maxLength={type === InputVarType.textInput ? TEXT_MAX_LENGTH : PARAGRAPH_MAX_LENGTH}
                modelId={modelConfig.model_id}
                value={max_length}
                onChange={handlePayloadChange('max_length')}
              />
            </Field>
          )}

          {/* 下拉选择类型 - 选项配置 */}
          {type === InputVarType.select && (
            <Field title={t('appDebug.variableConfig.options')}>
              <ConfigSelect options={options || []} onChange={handlePayloadChange('options')} />
            </Field>
          )}

          {/* 文件类型 - 上传配置 */}
          {[InputVarType.singleFile, InputVarType.multiFiles].includes(type) && (
            <FileUploadSetting
              payload={tempPayload as UploadFileSetting}
              onChange={(p: UploadFileSetting) => setTempPayload(p as InputVar)}
              isMultiple={type === InputVarType.multiFiles}
            />
          )}

          {/* 必填项开关 */}
          <Field title={t('appDebug.variableConfig.required')}>
            <Switch defaultValue={tempPayload.required} onChange={handlePayloadChange('required')} />
          </Field>
        </div>
      </div>
      <ModalFoot
        onConfirm={handleConfirm}
        onCancel={onClose}
      />
    </Modal>
  )
}

export default React.memo(ConfigModal)