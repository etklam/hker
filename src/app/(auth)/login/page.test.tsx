import {afterEach,describe,it,expect,vi} from 'vitest'
import {render,screen,cleanup} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Login from './page'
afterEach(()=>{cleanup();vi.restoreAllMocks()})
describe('admin login',()=>{
 it('exposes only administrator login',()=>{render(<Login/>);expect(screen.getByRole('heading',{name:'管理員登入'})).toBeInTheDocument();expect(screen.queryByText('Register')).not.toBeInTheDocument();expect(screen.getByLabelText('密碼')).toHaveAttribute('type','password')})
 it('shows the authentication failure without losing form input',async()=>{vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({message:'Invalid credentials'},{status:401}));render(<Login/>);await userEvent.type(screen.getByLabelText('電郵'),'admin@example.com');await userEvent.type(screen.getByLabelText('密碼'),'wrong');await userEvent.click(screen.getByRole('button',{name:'登入'}));expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');expect(screen.getByLabelText('電郵')).toHaveValue('admin@example.com')})
})
