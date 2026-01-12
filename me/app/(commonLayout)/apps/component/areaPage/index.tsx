import React, { useEffect, useState } from 'react'
import { Button, Space, Pagination } from 'antd'
import useSwr from 'swr'
import { useDebounceFn } from 'ahooks'
import { RiAddBoxLine } from '@remixicon/react'
import UserCard from '../base/userCard'
import AddArea from './addArea'
import type { AppListResponse } from '@/models/app'
import { getTenants } from '@/service/common'
import type { OpenTypes } from '@/app/(commonLayout)/apps/component/base/createModal'
import CreateModal from '@/app/(commonLayout)/apps/component/base/createModal'
import CreateFromDSLModal from '@/app/components/app/create-from-dsl-modal'
import GlobalUrl from '@/GlobalUrl'
import { Input } from 'antd'
import { SearchOutlined } from '@ant-design/icons'

type Props = {
  appData?: AppListResponse[] | undefined
  currentManualPage?: number
  setCurrentManualPage?: (page: number) => void
  totalItems?: number
  plugins?: any[] | undefined
  mutate?: (page?: number, limit?: number) => void
  pluginsMutate?: () => void
  setPluginAppsSize?: (size: number) => void
  setActiveTab?: (newActiveTab: string) => void
  setCallback?: any
  fetchList?: (page: number, limit: number) => Promise<AppListResponse>
  setSize: (size: number) => void
  pageSize?: number
  currentTabClick: string;
  setTcurrentTabClick: (key: string) => void;
  onPageSizeChange?: (size: number) => void;
  onSearchChange?: (searchVal: string) => void;
}

type AreaNameListItem = {
  id: string
  name: string
  status: string
  created_at: string
  current: boolean
}

type areaNameItem = {
  key: string
  name: string
}

const AreaPage: React.FC<Props> = (props) => {
  const {
    appData,
    currentManualPage: parentManualPage,
    setCurrentManualPage: setParentManualPage,
    totalItems: parentTotalItems,
    plugins,
    setActiveTab,
    mutate,
    pluginsMutate,
    setPluginAppsSize,
    setCallback,
    fetchList,
    setSize,
    pageSize
  } = props

  const [currentPage, setCurrentPage] = useState(parentManualPage || 1)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize || 20)
  const [openModal, setOpenModal] = useState<boolean>(false)
  const [activeArea, setActiveArea] = useState<any>('')
  const [showCreateFromDSLModal, setShowCreateFromDSLModal] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState<OpenTypes>({
    isOpen: false,
    title: '',
  })

  const { run: debouncedOnSearchChange } = useDebounceFn((searchVal: string) => {
    props.onSearchChange?.(searchVal);
  }, { wait: 300 });

  const [header_image, setHeaderImage] = useState('agent')
  const [areaName, setAreaName] = useState<Array<areaNameItem>>([])
  const [searchValue, setSearchValue] = useState<string>('');
  const [tabClick, setTabClick] = useState(() => {
    return '1';
  });

  const pageIndex = currentPage - 1
  const targetPageData = appData?.[(parentManualPage || currentPage) - 1]
  const targetPluginPageData = plugins?.[pageIndex];

  const dynamicTotalItems = (() => {
    if (tabClick === '2') {
      return targetPluginPageData?.total || 0;
    }
    return parentTotalItems || targetPageData?.total || 0;
  })();

  const totalItems = dynamicTotalItems

  const { data: tenants, mutate: tenantsMutate }: any = useSwr('/getTenants', getTenants)
  const PAGE_SIZE_OPTIONS = [20, 50, 100];
  const PAGE_SIZE = currentPageSize;

  const { run: debouncedFetchList } = useDebounceFn((page: number, limit: number) => {
    if (fetchList) {
      fetchList(page, limit);
    }
  }, { wait: 100 });

  const handleTabChange = (key: string) => {
    setTabClick(key);
    props.setTcurrentTabClick(key);
    const resetPage = 1
    setCurrentPage(resetPage)
    if (setParentManualPage) {
      setParentManualPage(resetPage)
    }

    const targetTabs = ['1', '3', '5'];
    if (targetTabs.includes(key)) {
      setSize(prevSize => Math.max(prevSize, resetPage));
    }

    if (key === '2' && pluginsMutate) {
      pluginsMutate();
      setPluginAppsSize?.(prevSize => Math.max(prevSize, resetPage));
      return;
    }

    if ((key === '1' || key === '3' || key === '5') && mutate) {
      mutate(resetPage, PAGE_SIZE);
    }

    mutate?.(1, PAGE_SIZE);
  };

  const handlePageChange = (newPage: number, newPageSize?: number) => {
    if (newPageSize && newPageSize !== currentPageSize) {
      setCurrentPageSize(newPageSize);
      props.onPageSizeChange?.(newPageSize);
      newPage = 1;
    }

    setCurrentPage(newPage)
    if (setParentManualPage) {
      setParentManualPage(newPage)
    }

    if (tabClick === '2') {
      if (setPluginAppsSize) {
        setPluginAppsSize(prevSize => Math.max(prevSize, newPage))
      }
      pluginsMutate?.();
    } else {
      setSize(prevSize => Math.max(prevSize, newPage))
      mutate?.(newPage, PAGE_SIZE)
    }
  };

  useEffect(() => {
    if (tenants) {
      const newArr: any = []
      const defaultSpace = tenants?.find((item: any) => item.current === true)
      if (defaultSpace) {
        setActiveArea(defaultSpace.id)
        setCallback(defaultSpace.id)
      }
      tenants.forEach((item: AreaNameListItem, index: any) => {
        newArr.push({ key: item.id, name: item.name })
      })
      setAreaName(newArr)
    }

    if (parentManualPage) {
      setCurrentPage(parentManualPage)
    }
  }, [tenants, parentManualPage, setCallback])

  useEffect(() => {
    setTabClick(props.currentTabClick);
  }, [props.currentTabClick]);

  useEffect(() => {
    const targetTabs = ['1', '3', '5'];
    if (!targetTabs.includes(tabClick) || !mutate) {
      return;
    }
  }, [tabClick, debouncedFetchList, PAGE_SIZE])

  const getTabName = () => {
    switch (tabClick) {
      case '1':
        return { name: 'Agent', mode: 'agent-chat', upload: '导入' };
      case '2':
        return { name: '插件', mode: 'chat' };
      case '3':
        return { name: '工作流', mode: 'workflow' };
      case '4':
        return { name: '智能体', mode: 'metabolic' };
      case '5':
        return { name: '对话流', mode: 'advanced-chat' };
      default:
        return { name: '' };
    }
  }

  const operations = () => {
    return <Space size="middle">
      <Input
        placeholder={`搜索${getTabName().name || '应用'}`}
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value);
          debouncedOnSearchChange(e.target.value);
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
          const headerImg = tabClick === '1' ? 'agent' : tabClick === '2' ? 'chat' : tabClick === '3' ? 'workflow' : 'metabolic'
          setHeaderImage(headerImg)
        }}
      >
        <RiAddBoxLine style={{ width: '20px', height: '20px', color: '#216EFF', marginRight: '5px' }} />
        <p style={{ color: '#216EFF' }}>{`创建${getTabName().name}`}</p>
      </div>
      {
        GlobalUrl.platform_type === 'shufa' && getTabName().upload &&
        <Button onClick={() => setShowCreateFromDSLModal(true)}>{getTabName().upload}</Button>
      }
    </Space>
  }

  const fromType = '个人空间';

  // 普通列表：双层容器分离 + 分页调整
  const renderListItems = (mode: string) => {
    const filteredData = targetPageData?.data?.filter(item => item.mode === mode) || [];
    return (
      <div style={{
        position: 'relative',
        minHeight: '360px',
        height: 'calc(100vh - 268px)',
        paddingBottom: '90px', // 适配bottom=24px，增大10px
        overflow: 'hidden'
      }}>
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
            filteredData.map((item, index) => (
              <UserCard
                headerImag={
                  mode === 'agent-chat' ? 'header_agent1' :
                    mode === 'workflow' ? 'header_workflow1' :
                      'header_workflow1'
                }
                mutate={() => mutate?.(currentPage, PAGE_SIZE)}
                key={item.id || index}
                fromType={fromType}
                data={item}
                areaList={areaName}
                tabClick={tabClick}
                activeArea={activeArea}
                currentTab={mode === 'agent-chat' ? 'agent' : 'workflow'}
              />
            ))
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              暂无{getTabName().name}数据
            </div>
          )}
        </div>

        {totalItems > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '8px', // 核心调整：从16px改为24px（向下移动8px）
            right: '24px',
            margin: 0,
            zIndex: 10,
            width: 'auto',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(item => item.toString())}
              showSizeChanger={true}
              showQuickJumper={true}
              total={totalItems}
              onChange={handlePageChange}
              showTotal={(total) => `共 ${total} 条 / 共 ${Math.ceil(total / PAGE_SIZE)} 页`}
            />
          </div>
        )}
      </div>
    );
  };

  // 插件列表：同步调整
  const renderPluginItems = () => {
    const currentPluginList = targetPluginPageData?.data || [];
    return (
      <div style={{
        position: 'relative',
        minHeight: '360px',
        height: 'calc(100vh - 268px)',
        paddingBottom: '90px', // 同步改为90px
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flex: 1,
          flexWrap: 'wrap',
          gap: '1.45vw'
        }}>
          {currentPluginList.length > 0 ? (
            currentPluginList.map((item, index) => (
              <UserCard
                headerImag='header_chat1'
                mutate={pluginsMutate}
                key={item.id || index}
                plugin={item}
                areaList={areaName}
                fromType={fromType}
                tabClick={tabClick}
                activeArea={activeArea}
                currentTab='chat'
              />
            ))
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              暂无插件数据
            </div>
          )}
        </div>

        {totalItems > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '8px', // 同步改为24px
            right: '24px',
            margin: 0,
            zIndex: 10,
            width: 'auto',
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(item => item.toString())}
              showSizeChanger={true}
              showQuickJumper={true}
              total={totalItems}
              onChange={handlePageChange}
              showTotal={(total) => `共 ${total} 条 / 共 ${Math.ceil(total / PAGE_SIZE)} 页`}
            />
          </div>
        )}
      </div>
    )
  }

  const items = [
    {
      label: 'Agent',
      key: '1',
      children: (
        <div className='flex-1 w-[100%]'>
          {renderListItems('agent-chat')}
        </div>
      ),
    },
    {
      label: '插件',
      key: '2',
      children: (
        <div className='flex-1 w-[100%]'>
          {renderPluginItems()}
        </div>
      ),
    },
    {
      label: '工作流',
      key: '3',
      children: (
        <div className='flex-1 w-[100%]'>
          {renderListItems('workflow')}
        </div>
      ),
    },
    {
      label: '对话流',
      key: '5',
      children: (
        <div className='flex-1 w-[100%]'>
          {renderListItems('advanced-chat')}
        </div>
      ),
    }
  ]

  return (
    <>
      <div className='mt-[24px]'>
        <div className='flex' style={{
          justifyContent: 'space-between',
          fontWeight: '700',
          backgroundColor: 'white',
          padding: '16px 16px',
          marginBottom: '16px',
          borderRadius: '8px',
          alignItems: 'center'
        }}>
          <div className='text-[#1C2748] text-[20px]'>个人空间</div>
        </div>

        <div
          className='bg-[#fff] rounded-[8px] px-[24px]'
          style={{ height: 'calc(100vh - 138px)', overflow: 'hidden' }}
        >
          <div style={{
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              {
                items.map(item => (
                  <Button
                    key={item.key}
                    style={{
                      marginRight: '16px',
                      color: item.key === tabClick ? '#1677ff' : '',
                      border: item.key === tabClick ? '1px solid #1677ff' : '1px solid rgb(217, 217, 217)'
                    }}
                    onClick={() => handleTabChange(item.key)}
                  >
                    {item.label}
                  </Button>
                ))
              }
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              {operations()}
              <Button style={{ marginLeft: '16px' }} onClick={() => {
                setActiveTab?.('release')
              }}>发布管理</Button>
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            {items.find(item => item.key === tabClick)?.children}
          </div>
        </div>
      </div >
      <CreateFromDSLModal
        tenant_id={activeArea}
        fromType='个人空间'
        tabClick={tabClick}
        show={showCreateFromDSLModal}
        onClose={() => setShowCreateFromDSLModal(false)}
        onSuccess={() => mutate?.(currentPage, PAGE_SIZE)}
      />
      <AddArea modalState={openModal} onClose={(val: boolean) => setOpenModal(val)} />
      {
        isAddOpen.isOpen
          ? <CreateModal
            fromType='个人空间'
            tabClick={tabClick}
            categoryTenants={true}
            tenant_id={activeArea}
            isAddOpen={isAddOpen}
            onClose={(val: boolean) => setIsAddOpen({ ...isAddOpen, isOpen: val })}
            onSuccess={() => mutate?.(currentPage, PAGE_SIZE)}
          />
          : null
      }
    </>
  )
}

export default AreaPage