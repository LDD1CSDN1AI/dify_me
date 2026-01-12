import {
  memo,
  useCallback,
  useMemo,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { useNodes } from 'reactflow'
import FormItem from '../nodes/_base/components/before-run-form/form-item'
import {
  BlockEnum,
  InputVarType,
  WorkflowRunningStatus,
} from '../types'
import {
  getProcessedInputs,
} from '@/app/components/base/chat/chat/utils'
import {
  useStore,
  useWorkflowStore,
} from '../store'
import { useWorkflowRun } from '../hooks'
import type { StartNodeType } from '../nodes/start/types'
import { TransferMethod } from '../../base/text-generation/types'
import Button from '@/app/components/base/button'
import { useFeatures } from '@/app/components/base/features/hooks'
import { Input } from 'antd';
import { useCheckInputsForms } from '@/app/components/base/chat/chat/check-input-forms-hooks'
import Toast from '../../base/toast';

const { TextArea } = Input;

type Props = {
  onRun: () => void
}

const InputsPanel = ({ onRun }: Props) => {
  const { t } = useTranslation()
  const workflowStore = useWorkflowStore()
  const fileSettings = useFeatures(s => s.features.file)
  const nodes = useNodes<StartNodeType>()
  const inputs = useStore(s => s.inputs) // 实时获取最新 inputs 状态
  const files = useStore(s => s.files)   // 实时获取最新 files 状态
  const workflowRunningData = useStore(s => s.workflowRunningData)
  const { checkInputsForm } = useCheckInputsForms()
  const { handleRun } = useWorkflowRun()
  const startNode = nodes.find(node => node.data.type === BlockEnum.Start)
  const startVariables = startNode?.data.variables
  const [textAreaValue, setTextAreaValue] = useState<string>('');

  // 1. 修复：变量列表生成逻辑（保持不变，但确保依赖正确）
  const variables = useMemo(() => {
    const data = startVariables || []
    if (fileSettings?.image?.enabled) {
      return [
        ...data,
        {
          type: InputVarType.files,
          variable: '__image',
          required: false,
          label: 'files',
        },
      ]
    }
    return data
  }, [fileSettings?.image?.enabled, startVariables])

  // 2. 修复：值变更逻辑（实时获取最新状态，避免覆盖）
  const handleValueChange = useCallback((variable: string, v: any) => {
    const currentState = workflowStore.getState()
    if (variable === '__image') {
      // 更新文件状态
      workflowStore.setState({
        files: v,
      })
    } else {
      // 实时合并最新 inputs，避免覆盖
      currentState.setInputs({
        ...currentState.inputs,
        [variable]: v,
      })
    }
  }, [workflowStore])

  // 3. 修复：JSON 导入逻辑（增加格式校验、处理文件字段）
  const importJson = useCallback(() => {
    if (!textAreaValue.trim()) {
      Toast.notify({
        type: 'error',
        message: '请输入JSON内容'
      });
      return;
    }

    try {
      const parsedData = JSON.parse(textAreaValue);
      if (typeof parsedData !== 'object' || parsedData === null) {
        throw new Error('JSON 必须是对象类型');
      }

      const currentState = workflowStore.getState();
      // 分离文件字段和普通输入字段
      const { __image, ...inputData } = parsedData;

      // 更新普通输入字段
      currentState.setInputs({
        ...currentState.inputs, // 保留原有输入，仅覆盖导入的字段
        ...inputData,
      });

      // 更新文件字段（如果有）
      if (__image) {
        workflowStore.setState({
          files: Array.isArray(__image) ? __image : [__image],
        });
      }

      Toast.notify({
        type: 'success',
        message: 'JSON 导入成功'
      });
      setTextAreaValue(''); // 清空输入框
    } catch (e) {
      Toast.notify({
        type: 'error',
        message: `JSON 解析失败：${(e as Error).message}`
      });
    }
  }, [textAreaValue, workflowStore])

  // 4. 修复：canRun 改为 useMemo，依赖变更时重新计算
  const canRun = useMemo(() => {
    // 检查是否有未上传完成的本地文件
    const hasUnuploadedFiles = files?.some(
      item => (item.transfer_method as any) === TransferMethod.local_file && !item.upload_file_id
    );
    return !hasUnuploadedFiles;
  }, [files])

  // 5. 修复：运行逻辑（确保依赖全量、状态最新）
  const doRun = useCallback(() => {
    if (!checkInputsForm(inputs, variables as any)) return;

    onRun();
    handleRun({
      inputs: getProcessedInputs(inputs, variables as any),
      files: [...files] // 传递文件副本，避免状态突变
    });
  }, [files, handleRun, inputs, onRun, variables, checkInputsForm])

  return (
    <>
      {/* JSON 导入区域 */}
      <div className='px-4 pb-2 mt-2'>
        <TextArea
          placeholder='请输入JSON格式的输入参数（示例：{"name":"测试","age":18}）'
          onChange={(e) => setTextAreaValue(e.target.value)}
          value={textAreaValue}
          rows={4}
          className='w-full'
        />
      </div>
      <div className='flex items-center justify-between px-4 py-2'>
        <Button
          variant='primary'
          className='w-full'
          onClick={importJson}
        >导入JSON以自动填充</Button>
      </div>

      {/* 输入项列表 */}
      <div className='px-4 pb-2'>
        {variables.map((variable, index) => (
          <div
            key={variable.variable}
            className='mb-2 last-of-type:mb-0'
          >
            <FormItem
              autoFocus={index === 0}
              className='!block'
              payload={variable}
              value={
                // 区分文件字段和普通字段的取值
                variable.variable === '__image' ? files : inputs[variable.variable]
              }
              onChange={v => handleValueChange(variable.variable, v)}
            />
          </div>
        ))}
      </div>

      {/* 运行按钮 */}
      <div className='flex items-center justify-between px-4 py-2'>
        <Button
          variant='primary'
          disabled={!canRun || workflowRunningData?.result?.status === WorkflowRunningStatus.Running}
          className='w-full'
          onClick={doRun}
        >
          {t('workflow.singleRun.startRun')}
        </Button>
      </div>
    </>
  )
}

export default memo(InputsPanel)