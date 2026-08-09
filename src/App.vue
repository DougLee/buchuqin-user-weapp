<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'; import { useSessionStore } from './stores/session'
onLaunch(()=>{ void useSessionStore().ensureLogin() })
</script>
<style lang="scss">
@import './styles/theme.scss';
page{background:$paper;color:$ink;font-family:"PingFang SC","Noto Sans CJK SC",sans-serif;font-size:30rpx} view,text,image,button,input,textarea,scroll-view{box-sizing:border-box} button::after{border:none}
.page{min-height:100vh;padding:28rpx 28rpx 160rpx}.card{background:$surface;border:2rpx solid rgba(75,48,37,.08);border-radius:30rpx;box-shadow:0 12rpx 30rpx rgba(91,51,32,.08)}
.section-title{display:flex;align-items:flex-end;justify-content:space-between;margin:38rpx 2rpx 22rpx}.section-title__main{font-size:38rpx;font-weight:800;letter-spacing:-1rpx}.section-title__sub{color:$muted;font-size:24rpx}
.primary-btn{min-height:92rpx;display:flex;align-items:center;justify-content:center;border-radius:46rpx;background:$primary;color:#fff;font-weight:800;font-size:30rpx;box-shadow:0 10rpx 0 $primary-dark}.primary-btn[disabled]{opacity:.55;box-shadow:none}.price{color:$primary-dark;font-weight:900}.price__symbol{font-size:22rpx}.muted{color:$muted}.safe-bottom{padding-bottom:env(safe-area-inset-bottom)}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
