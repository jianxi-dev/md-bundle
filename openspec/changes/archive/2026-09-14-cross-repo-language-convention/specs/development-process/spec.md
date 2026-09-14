# Development Process

## ADDED Requirements

### Requirement: 产品仓库语言约定统一

The md-bundle repository `AGENTS.md` MUST declare, in a mandatory conventions section, that all feedback to the user is written in Chinese, matching the convention already present in the mdpkg repository, so that the language rule is discoverable in every product repository rather than only in one of them.

#### Scenario: md-bundle 声明中文反馈约定

- Given the md-bundle repository root
- When reading `AGENTS.md`
- Then a mandatory conventions section declares that all feedback to the user is in Chinese

#### Scenario: 与 mdpkg 措辞一致

- Given the mdpkg `AGENTS.md` mandatory conventions section
- When comparing it with the md-bundle one
- Then both declare Chinese as the language for all user feedback
