<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useSessionStore } from './stores/session'
onLaunch(() => { void useSessionStore().ensureLogin() })
</script>
<style lang="scss">
@import './styles/theme.scss';
page{background:$paper;color:$ink;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:30rpx;line-height:1.55}view,text,image,button,input,textarea,scroll-view{box-sizing:border-box}button::after{border:none}button,[role=button]{touch-action:manipulation}button:focus,input:focus,textarea:focus{outline:4rpx solid rgba(37,185,90,.22);outline-offset:2rpx}
.page{min-height:100vh;padding:28rpx 28rpx 180rpx}.card{background:$surface;border:2rpx solid rgba(32,74,45,.07);border-radius:28rpx;box-shadow:0 8rpx 28rpx rgba(21,75,38,.07)}input,textarea{color:$ink}textarea{font-size:28rpx}.card,.primary-btn,button{transition:background-color .2s ease,border-color .2s ease,box-shadow .2s ease,opacity .2s ease}.muted{color:#667069!important}
.section-title{display:flex;align-items:center;justify-content:space-between;margin:38rpx 2rpx 22rpx}.section-title__main{font-size:34rpx;font-weight:800}.section-title__main::before{content:"";display:inline-block;width:8rpx;height:32rpx;border-radius:8rpx;background:$primary;margin-right:14rpx;vertical-align:-4rpx}.section-title__sub{color:$muted;font-size:24rpx}
.primary-btn{min-height:92rpx;display:flex;align-items:center;justify-content:center;border-radius:46rpx;background:linear-gradient(135deg,$primary,$primary-dark);color:#fff;font-weight:800;font-size:30rpx;box-shadow:0 8rpx 20rpx rgba(37,185,90,.24)}.primary-btn[disabled]{opacity:.55;box-shadow:none}.price{color:#ff4d18;font-weight:900}.price__symbol{font-size:22rpx}.safe-bottom{padding-bottom:env(safe-area-inset-bottom)}
@media(min-width:768px){.page{max-width:750px;margin:0 auto}.uni-tabbar{max-width:750px;left:50%!important;transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
