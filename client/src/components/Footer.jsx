import React from 'react'
import { assets } from '../assets/assets'

const Footer = () => {
  return (
    <footer className="px-6 md:px-16 lg:px-24 xl:px-32 pt-8 w-full text-gray-500 mt-20">
    <div className="flex flex-col md:flex-row justify-between w-full gap-10 border-b border-gray-500/30 pb-6">
        <div className="md:max-w-96">
            <img className="h-9" src={assets.logo} alt="Logo" />
            <p className="mt-6 text-sm">
                QuickAI brings writing, image creation, and resume feedback into one workspace.<br />Create, revisit your work, and share images with the community.
            </p>
        </div>
        <div className="flex-1 flex items-start md:justify-end gap-20">
            <div>
                <h2 className="font-semibold mb-5 text-gray-800">Company</h2>
                <ul className="text-sm space-y-2">
                    <li><a href="/">Home</a></li>
                    <li><span>About us · Coming soon</span></li>
                    <li><a href="https://github.com/Leslie0957/QuickAI">GitHub project</a></li>
                    <li><span>Privacy policy · Coming soon</span></li>
                </ul>
            </div>
            <div>
                <h2 className="font-semibold text-gray-800 mb-5">Subscribe to our newsletter</h2>
                <div className="text-sm space-y-2">
                    <p>Demo form only. Email subscriptions are not connected yet.</p>
                    <div className="flex items-center gap-2 pt-4">
                        <input disabled aria-label="Email subscription is not available yet" className="border border-gray-500/30 placeholder-gray-500 focus:ring-2 ring-indigo-600 outline-none w-full max-w-64 h-9 rounded px-2" type="email" placeholder="Enter your email" />
                        <button disabled className="bg-primary px-4 h-9 text-white rounded opacity-60 cursor-not-allowed whitespace-nowrap">Coming soon</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <p className="pt-4 text-center text-xs md:text-sm pb-5">
        Copyright 2026
    </p>
</footer>
  )
}

export default Footer
