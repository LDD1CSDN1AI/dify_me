'use client'
import useSwr from 'swr'
import React, { useEffect, useState, useCallback } from 'react'
import { Avatar, Breadcrumb, Button, ConfigProvider, Divider, Space, Tabs, Tag, message, Modal, Input, Pagination } from 'antd'
import {
  FormOutlined,
  SearchOutlined // 新增：导入搜索图标
} from '@ant-design/icons'
import {
  RiAddBoxLine,
} from '@remixicon/react'
import zhCN from 'antd/es/locale/zh_CN'
import UserCard from '../base/userCard'
import { getTenants } from '@/service/common'
import type { OpenTypes } from '@/app/(commonLayout)/apps/component/base/createModal'
import CreateModal from '@/app/(commonLayout)/apps/component/base/createModal'
import { useAppContext } from '@/context/app-context'
import { getQueryParams } from '@/utils/getUrlParams'
import { outProjectTenant, editProjectName, getTenantDetail } from "@/service/apps";
import { getRedirection } from '@/utils/app-redirection'
import { useRouter } from 'next/navigation'
import Datasets from '../datasets'
import GlobalUrl from '@/GlobalUrl'
import { useDebounceFn } from 'ahooks'
const { confirm } = Modal;

type Props = {
  setActiveTab?: any
  data?: any[] | undefined
  mutate?: (page?: number, limit?: number) => void
  setCallback?: any
  plugins?: any[] | undefined // 插件分页分段数据（数组套数组）
  pluginsMutate?: (page?: number, limit?: number) => void // 插件分页刷新方法
  currentManualPage?: number
  setCurrentManualPage?: (page: number) => void
  totalItems?: number
  pluginTotalItems?: number // 插件独立总条数
  setSize?: (size: number) => void
  setPluginSize?: (size: number) => void // 插件页码加载控制
  pageSize?: number
  // 新增：接收父组件传递的当前选项卡
  currentTabClick?: string
  // 新增：向父组件传递选项卡变更
  setTcurrentTabClick?: (tabKey: string) => void
  // 新增：条数变更回调（和AreaPage一致）
  onPageSizeChange?: (size: number) => void
  // 新增：搜索变更回调（和AreaPage一致）
  onSearchChange?: (searchVal: string) => void
}

const WorkSpaceSecondPage: React.FC<Props> = (props) => {
  const {
    setActiveTab,
    data,
    mutate,
    setCallback,
    plugins,
    pluginsMutate,
    currentManualPage: parentManualPage,
    setCurrentManualPage: setParentManualPage,
    totalItems: parentTotalItems,
    pluginTotalItems: parentPluginTotalItems,
    setSize,
    setPluginSize,
    pageSize = 12,
    // 新增：接收父组件的选项卡状态
    currentTabClick: parentCurrentTab,
    setTcurrentTabClick: setParentCurrentTab,
    onPageSizeChange, // 新增：条数变更回调
    onSearchChange,   // 新增：搜索变更回调
  } = props
  // 新增：使用父组件传递的选项卡状态，没有则使用默认值
  const [tabClick, setTabClick] = useState<string>(parentCurrentTab || '1')

  // 新增：每页条数状态（优先使用父组件传递的值，默认20，和AreaPage一致）
  const [currentPageSize, setCurrentPageSize] = useState(pageSize || 20)
  // 新增：搜索框输入值状态（和AreaPage一致）
  const [searchValue, setSearchValue] = useState<string>('')
  // 新增：可选每页条数配置（和AreaPage一致，可自定义）
  const PAGE_SIZE_OPTIONS = [20, 50, 100]

  // 新增：当父组件传递的选项卡变化时同步更新
  useEffect(() => {
    if (parentCurrentTab) {
      setTabClick(parentCurrentTab)
    }
  }, [parentCurrentTab])

  // 优化：父子每页条数同步（增加条件判断，避免无效更新）
  useEffect(() => {
    // 仅当 pageSize 存在且与当前子组件条数不一致时，才更新
    if (pageSize !== undefined && pageSize !== currentPageSize) {
      setCurrentPageSize(pageSize)
    }
  }, [pageSize, currentPageSize])

  const tenantId = getQueryParams('tenant_id')
  const role = getQueryParams('role')
  const [nameInput, setIsSHowNameInput] = useState<any>(false)
  const [projectName, setProjectName] = useState<any>('')
  const [isName, setNameIS] = useState<any>('')
  const [isRole, setIsRole] = useState<any>('')
  const [showCreateFromDSLModal, setShowCreateFromDSLModal] = useState(false)
  const { isCurrentWorkspaceEditor } = useAppContext()
  const [isAddOpen, setIsAddOpen] = useState<OpenTypes>({
    isOpen: false,
    title: '',
  })
  const [activeArea, setActiveArea] = useState<any>('')
  const [areaName, setAreaName] = useState<any>([])
  const { push } = useRouter()
  const { data: tenants, mutate: tenantsMutate }: any = useSwr('/getTenants', getTenants)

  // 分页核心状态
  const [currentPage, setCurrentPage] = useState(parentManualPage || 1)
  const pageIndex = currentPage - 1
  const targetPageData = data?.[(parentManualPage || currentPage) - 1]

  // 修正：动态总条数依赖当前每页条数（替换原有pageSize为currentPageSize）
  const dynamicTotalItems = tabClick === '2'
    ? parentPluginTotalItems || (plugins?.[pageIndex]?.total || 0)
    : parentTotalItems || (targetPageData?.total || 0)

  // 插件当前页数据
  const currentPluginPageData = plugins?.[pageIndex]?.data || []

  // 防抖处理插件数据请求
  const { run: debouncedPluginMutate } = useDebounceFn((page: number, limit: number) => {
    if (pluginsMutate) {
      pluginsMutate(page, limit)
    }
  }, { wait: 100 })

  // 新增：搜索防抖处理（和AreaPage一致，300ms延迟）
  const { run: debouncedOnSearchChange } = useDebounceFn((searchVal: string) => {
    onSearchChange?.(searchVal) // 调用父组件搜索回调
  }, { wait: 300 })

  // 核心修复：分页切换处理（严格区分页码变更和条数变更，避免误重置页码）
  const handlePageChange = (newPage: number, newPageSize?: number) => {
    // 1. 仅当 newPageSize 存在且与当前条数不一致时，才处理条数变更并重置页码
    let targetPage = newPage; // 默认目标页码为传入的新页码
    if (newPageSize !== undefined && newPageSize !== currentPageSize) {
      setCurrentPageSize(newPageSize);
      onPageSizeChange?.(newPageSize);
      targetPage = 1; // 只有条数变更时，才重置到第1页
      // 同步父组件页码
      if (setParentManualPage) {
        setParentManualPage(targetPage);
      }
      setCurrentPage(targetPage);
    } else {
      // 2. 仅页码变更时，正常更新页码，不重置
      setCurrentPage(newPage);
      if (setParentManualPage) {
        setParentManualPage(newPage);
      }
      targetPage = newPage;
    }

    // 3. 区分插件和其他选项卡的分页逻辑（使用最终的目标页码）
    if (tabClick === '2') {
      // 插件分页处理
      if (setPluginSize) {
        setPluginSize(prev => Math.max(prev, targetPage));
      }
      debouncedPluginMutate(targetPage, currentPageSize);
    } else {
      // 其他选项卡分页处理
      if (setSize) {
        setSize(prev => Math.max(prev, targetPage));
      }
      if (mutate) {
        mutate(targetPage, currentPageSize);
      }
    }
  }

  // 【修改1】插件列表：双层容器 + 分页固定右下角（和AreaPage完全对齐）
  const renderPluginList = () => {
    return (
      // 外层容器：相对定位（分页定位参考）+ 固定高度
      <div style={{
        position: 'relative',
        minHeight: '360px',
        height: '100%', // 继承Tabs子组件高度
        paddingBottom: '80px', // 关键修改1：和AreaPage统一为80px
        overflow: 'hidden' // 关键修改2：添加overflow hidden
      }}>
        {/* 内层容器：独立滚动，与分页解耦 */}
        <div style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flex: 1,
          flexWrap: 'wrap',
          gap: '1.45vw'
        }}>
          {currentPluginPageData.length > 0 ? (
            currentPluginPageData.map((item: any, index: any) => (
              <UserCard
                headerImag='header_chat1'
                mutate={() => pluginsMutate?.(currentPage, currentPageSize)}
                key={item.id || index}
                plugin={item}
                areaList={areaName}
                fromType='项目空间'
                tabClick={tabClick}
                activeArea={activeArea}
                currentTab='chat'
              />
            ))
          ) : (
            <div style={{
              width: '100%',
              height: '100%', // 继承内层容器高度
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              暂无插件数据
            </div>
          )}
        </div>

        {/* 插件分页：绝对定位右下角，完全固定（和AreaPage完全对齐） */}
        {dynamicTotalItems > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '24px', // 关键修改3：统一底部偏移
            right: '24px',  // 关键修改4：统一右侧偏移
            margin: 0,      // 关键修改5：移除默认margin
            zIndex: 10,
            width: 'auto',  // 关键修改6：移除width:100%，改为auto
            display: 'flex',
            justifyContent: 'flex-end' // 靠右对齐
          }}>
            <Pagination
              current={currentPage}
              pageSize={currentPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(item => item.toString())}
              showSizeChanger={true}
              showQuickJumper={true}
              total={dynamicTotalItems}
              onChange={(page, pageSize) => handlePageChange(page, pageSize)}
              showTotal={(total) => `共 ${total} 条 / 共 ${Math.ceil(total / currentPageSize)} 页`}
            />
          </div>
        )}
      </div>
    )
  }

  // 【修改2】其他选项卡列表：双层容器 + 分页固定右下角（和AreaPage完全对齐）
  const renderTabList = (mode: string) => {
    const filteredData = targetPageData?.data?.filter((i: any) => i.mode === mode) || []

    const getTabDisplayName = () => {
      switch (mode) {
        case 'agent-chat': return 'Agent'
        case 'workflow': return '工作流'
        case 'advanced-chat': return '对话流'
        default: return ''
      }
    }

    return (
      // 外层容器：相对定位（分页定位参考）+ 固定高度
      <div style={{
        position: 'relative',
        minHeight: '360px',
        height: '100%', // 继承Tabs子组件高度
        paddingBottom: '80px', // 关键修改1：和AreaPage统一为80px
        overflow: 'hidden' // 关键修改2：添加overflow hidden
      }}>
        {/* 内层容器：独立滚动，与分页解耦 */}
        <div style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flex: 1,
          flexWrap: 'wrap',
          gap: '1.45vw'
        }}>
          {filteredData.length > 0 ? (
            filteredData.map((item: any, index: any) => {
              const currentTab = mode === 'agent-chat' ? 'agent' : 'workflow'
              const headerImg = mode === 'agent-chat' ? 'header_agent1' : 'header_workflow1'
              return (
                <UserCard
                  headerImag={headerImg}
                  mutate={() => mutate?.(currentPage, currentPageSize)}
                  key={item.id || index}
                  data={item}
                  areaList={areaName}
                  tabClick={tabClick}
                  fromType='项目空间'
                  activeArea={activeArea}
                  currentTab={currentTab}
                  appId={targetPageData?.id}
                />
              )
            })
          ) : (
            <div style={{
              width: '100%',
              height: '100%', // 继承内层容器高度
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              暂无{getTabDisplayName()}数据
            </div>
          )}
        </div>

        {/* 分页：绝对定位右下角，完全固定（和AreaPage完全对齐） */}
        {dynamicTotalItems > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '24px', // 关键修改3：统一底部偏移
            right: '24px',  // 关键修改4：统一右侧偏移
            margin: 0,      // 关键修改5：移除默认margin
            zIndex: 10,
            width: 'auto',  // 关键修改6：移除width:100%，改为auto
            display: 'flex',
            justifyContent: 'flex-end' // 靠右对齐
          }}>
            <Pagination
              current={currentPage}
              pageSize={currentPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(item => item.toString())}
              showSizeChanger={true}
              showQuickJumper={true}
              total={dynamicTotalItems}
              onChange={(page, pageSize) => handlePageChange(page, pageSize)}
              showTotal={(total) => `共 ${total} 条 / 共 ${Math.ceil(total / currentPageSize)} 页`}
            />
          </div>
        )}
      </div>
    )
  }

  const outProject = async () => {
    const path = role === 'owner' ? `/deleteTenant?tenant_id=${tenantId}` : `/outTenant?tenant_id=${tenantId}`
    confirm({
      title: `确定${role === 'owner' ? '解散' : '退出'}该空间？`,
      content: `${role === 'owner' ? '解散项目空间后，项目成员被踢出项目空间，空间中的项目会被删除，且解散操作不可撤销' : '退出项目空间后，项目成员被踢出项目空间，空间中的项目会被删除，且退出操作不可撤销'}`,
      onOk: async () => {
        const res: any = await outProjectTenant({ url: path })
        if (res.result === "success") {
          message.info(`${role === 'owner' ? '解散' : '退出'}成功！`);
          setActiveTab?.('projectSpace')
        } else if (res.result === 'error') {
          message.info(`${role === 'owner' ? '解散失败' : '当前空间下存在应用，无法退出'}`);
        }
      },
      onCancel() { },
    });
  };

  const editName = async () => {
    const res: any = await editProjectName({
      url: '/updateTenant',
      body: {
        id: tenantId,
        name: projectName,
      }
    })

    if (res.result === "success") {
      setProjectName(projectName)
      message.info('修改成功！')
    } else {
      message.info('修改失败')
    }
    setIsSHowNameInput(false)
  }

  const getProjectDetail = async () => {
    const res: any = await getTenantDetail({ appId: tenantId })
    setProjectName(res.name || '')
  }

  useEffect(() => {
    if (tenants && tenantId) {
      const newArr: any = []
      const defaultSpace = tenants?.find((item: any) => item.id === tenantId)
      setActiveArea(defaultSpace?.id)
      setCallback(defaultSpace?.id)
      tenants.forEach((item: any) => {
        newArr.push({ key: item.id, name: item.name })
      })
      setAreaName(newArr)
    }
  }, [tenants, tenantId])

  useEffect(() => {
    if (tenants)
      tenants.map((item: any) => {
        if (item.id === tenantId) {
          setNameIS(item.name)
          setIsRole(item.role)
        }
      })
  })

  useEffect(() => {
    if (tenantId) {
      getProjectDetail()
    }
  }, [tenantId])

  const getTabTitle = () => {
    switch (tabClick) {
      case '1': return 'Agent';
      case '2': return '插件';
      case '3': return '工作流';
      case '5': return '对话流';
      default: return '';
    }
  }

  const getTabName = () => {
    switch (tabClick) {
      case '1': return { name: 'Agent', mode: 'agent-chat', upload: '导入' };
      case '2': return { name: '插件', mode: 'chat' };
      case '3': return { name: '工作流', mode: 'workflow' };
      case '5': return { name: '对话流', mode: 'advanced-chat' };
      default: return { name: '' };
    }
  }

  // 升级：添加搜索框（和AreaPage样式、逻辑一致）
  const operations = () => {
    return <Space>
      {/* 新增：搜索框 */}
      <Input
        placeholder={`搜索${getTabName().name || '内容'}`}
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value)
          debouncedOnSearchChange(e.target.value)
        }}
        style={{
          width: 220,
          height: 32,
          border: '1px solid #d9d9d9',
          borderRadius: '4px'
        }}
        prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
      />

      <div
        className='flex items-center justify-center text-18 text-#216EFF cursor-pointer color-#216EFF'
        onClick={() => {
          const mode = getTabName().mode;
          setIsAddOpen({
            isOpen: true,
            title: `创建${getTabName().name}`,
            titleName: `${getTabName().name}`,
            mode,
          })
        }}
      >
        {tabClick !== '4' && getTabTitle() && (
          <>
            <RiAddBoxLine style={{ width: '20px', height: '20px', color: '#216EFF', marginRight: '5px' }} />
            <p style={{ color: '#216EFF' }}>{getTabTitle()}</p>
          </>
        )}
      </div>
    </Space>
  }

  // 升级：fetchTabData使用currentPageSize
  const fetchTabData = async (tabKey: string) => {
    try {
      const resetPage = 1
      switch (tabKey) {
        case '1':
          props.setTcurrentTabClick('1');
          await mutate?.(resetPage, currentPageSize);
          break;
        case '2':
          await debouncedPluginMutate(resetPage, currentPageSize);
          break;
        case '3':
          props.setTcurrentTabClick('3');
          await mutate?.(resetPage, currentPageSize);
          break;
        case '5':
          props.setTcurrentTabClick('5');
          await mutate?.(resetPage, currentPageSize);
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('数据加载失败:', error);
      message.error('数据加载失败，请重试');
    }
  };

  const items = [
    {
      label: 'Agent',
      key: '1',
      children: (
        // 内层滚动交给renderTabList，此处仅传递高度
        <div className='flex-1 w-[100%]' style={{ height: 'calc(100vh - 268px)' }}>
          {renderTabList('agent-chat')}
        </div>
      ),
    },
    {
      label: '插件',
      key: '2',
      children: (
        <div className='flex-1 w-[100%]' style={{ height: 'calc(100vh - 268px)' }}>
          {renderPluginList()}
        </div>
      ),
    },
    {
      label: '工作流',
      key: '3',
      children: (
        <div className='flex-1 w-[100%]' style={{ height: 'calc(100vh - 268px)' }}>
          {renderTabList('workflow')}
        </div>
      ),
    },
    {
      label: '知识库',
      key: '6',
      children: (
        <div className='flex-1 w-[100%] overflow-y-auto' style={{ height: 'calc(100vh - 268px)' }}>
          <Datasets fromSource={'workSpaceSecondPage'} tenant_id={tenantId} />
        </div>
      ),
    },
    {
      label: '对话流',
      key: '5',
      children: (
        <div className='flex-1 w-[100%]' style={{ height: 'calc(100vh - 268px)' }}>
          {renderTabList('advanced-chat')}
        </div>
      ),
    },
  ]

  const breadcrumbItem = [
    { title: <a onClick={() => setActiveTab?.('all')}>首页</a> },
    { title: <a onClick={() => setActiveTab?.('projectSpace')}>项目空间</a> },
    { title: <div>{projectName}</div> },
  ]

  return (
    <ConfigProvider locale={zhCN}>
      <div className='mt-[24px]'>
        <Breadcrumb
          style={{ margin: '-16px 0px 5px 0px', fontSize: '12px' }}
          items={breadcrumbItem}
        />
        <div className='flex' style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          height: '80px',
          marginBottom: '15px',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0px 20px',
        }}>
          <div className='cardDetail' style={{ display: 'flex', alignItems: 'center' }}>
            <div className='avatar' style={{ marginRight: '20px' }}>
              <Avatar shape="square" size={50} src={'/agent-platform-web/image/header_agent1.png'} />
            </div>
            <div className='otherthing'>
              <div className="titlePart" style={{ display: 'flex', marginBottom: '6px' }}>
                <div className='title'>
                  {nameInput === true
                    ? <Input
                      placeholder='请输入姓名'
                      value={projectName}
                      onBlur={editName}
                      onChange={(e) => setProjectName(e.currentTarget.value)}
                    />
                    : projectName
                  }
                </div>
                <div
                  className='icon'
                  onClick={(e) => {
                    e.preventDefault()
                    setIsSHowNameInput(true)
                  }}
                  style={{ marginLeft: '10px', cursor: 'pointer' }}
                >
                  <FormOutlined />
                </div>
              </div>
              <div className="tags">
                <Tag bordered={false} color='blue'>项目空间</Tag>
                <Tag bordered={false} color='blue'>{(isRole === 'owner' || isRole === 'admin') ? '管理员' : '普通用户'}</Tag>
              </div>
            </div>
          </div>
          <div className='buttons' style={{
            minWidth: '30vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-evenly',
          }}>
            {role === 'owner' || role === 'admin' ? (
              <Button onClick={() => {
                setActiveTab?.('project-member')
                getRedirection(isCurrentWorkspaceEditor, {
                  tenant_id: tenantId,
                  role: isRole,
                  mode: 'project-member'
                }, push)
              }}>
                成员管理
              </Button>
            ) : ''}

            <Button onClick={outProject}>{role === 'owner' ? '解散' : '退出'}项目</Button>
            <Divider type='vertical' style={{ height: '30px' }} />
            {GlobalUrl.platform_type === 'wangyun' && (
              <Button onClick={() => {
                localStorage.setItem('tenantId', tenantId)
                setActiveTab?.('appExamine')
                getRedirection(isCurrentWorkspaceEditor, {
                  breadcrumb: isName,
                  role: isRole,
                  tenant_id: tenantId,
                  mode: 'appExamine'
                }, push)
              }}>
                {isRole === 'owner' || isRole === 'admin' ? '应用审批' : '申请管理'}
              </Button>
            )}
          </div>
        </div>
        <div
          className='bg-[#fff] rounded-[8px] px-[24px]'
          style={{ height: 'calc(100vh - 218px)', overflow: 'hidden' }}
        >
          <Tabs
            tabBarExtraContent={operations()}
            items={items.filter(item => item.key === '6' && GlobalUrl.platform_type === 'wangyun' ? false : true)}
            activeKey={tabClick}
            onChange={(val) => {
              setTabClick(val)
              const resetPage = 1
              setCurrentPage(resetPage)
              if (setParentManualPage) {
                setParentManualPage(resetPage)
              }
              fetchTabData(val);
            }}
          />
        </div>
      </div>

      {isAddOpen.isOpen && (
        <CreateModal
          fromType={'项目空间'}
          tabClick={tabClick}
          disabled={true}
          tenant_id={activeArea}
          isAddOpen={isAddOpen}
          onClose={(val: boolean) => setIsAddOpen({ ...isAddOpen, isOpen: val })}
        />
      )}
    </ConfigProvider>
  )
}
export default WorkSpaceSecondPage